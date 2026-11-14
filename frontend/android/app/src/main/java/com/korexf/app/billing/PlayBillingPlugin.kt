package com.korexf.app.billing

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * KoreX's own Play Billing bridge (no intermediaries). It only talks to Google Play:
 * it NEVER grants anything. Every purchase token goes to the backend
 * (POST /api/subscriptions/google/verify), which reads it from the Play Developer API,
 * grants the plan and acknowledges. acknowledge() here is only the app's backup.
 */
@CapacitorPlugin(name = "PlayBilling")
class PlayBillingPlugin : Plugin() {

    private lateinit var billing: BillingClient
    private var pendingPurchase: PluginCall? = null
    private var details: ProductDetails? = null

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        val call = pendingPurchase
        pendingPurchase = null
        if (result.responseCode == BillingResponseCode.OK && !purchases.isNullOrEmpty()) {
            if (call != null) {
                call.resolve(purchaseJson(purchases.first()))
                purchases.drop(1).forEach { notifyListeners(EVENT, purchaseJson(it), true) }
            } else {
                // completed outside the direct flow (pending payment, another device…): report it too,
                // retained until the JS watcher (PlayPurchaseWatcher) is listening
                purchases.forEach { notifyListeners(EVENT, purchaseJson(it), true) }
            }
        } else if (call != null) {
            reject(call, result)
        }
    }

    override fun load() {
        billing = BillingClient.newBuilder(context)
            .setListener(purchasesListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()
    }

    override fun handleOnDestroy() {
        if (::billing.isInitialized) billing.endConnection()
        super.handleOnDestroy()
    }

    /** Runs [block] once the client is connected; rejects the call if Play is unavailable. */
    private fun connected(call: PluginCall, block: () -> Unit) {
        if (billing.isReady) return block()
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingResponseCode.OK) block() else reject(call, result)
            }
            override fun onBillingServiceDisconnected() { /* auto reconnection is enabled */ }
        })
    }

    private fun loadDetails(call: PluginCall, productId: String, then: (ProductDetails) -> Unit) {
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
            QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(ProductType.SUBS).build()
        )).build()
        billing.queryProductDetailsAsync(params) { result, found ->
            val pd = found.productDetailsList.firstOrNull()
            when {
                result.responseCode != BillingResponseCode.OK -> reject(call, result)
                pd == null -> call.reject("Product $productId not found", "PRODUCT_NOT_FOUND")
                else -> { details = pd; then(pd) }
            }
        }
    }

    /** The offer to sell: the one with a free phase (trial) if Play says the user is eligible, else the base plan. */
    private fun chosenOffer(pd: ProductDetails): ProductDetails.SubscriptionOfferDetails? {
        val offers = pd.subscriptionOfferDetails ?: return null
        return offers.firstOrNull { o -> o.pricingPhases.pricingPhaseList.any { it.priceAmountMicros == 0L } }
            ?: offers.firstOrNull { it.offerId == null }
            ?: offers.firstOrNull()
    }

    @PluginMethod
    fun getProductDetails(call: PluginCall) {
        val productId = call.getString("productId") ?: DEFAULT_PRODUCT
        connected(call) {
            loadDetails(call, productId) { pd ->
                val offer = chosenOffer(pd)
                if (offer == null) {
                    call.reject("No offer for $productId", "PRODUCT_NOT_FOUND")
                    return@loadDetails
                }
                val phases = JSArray()
                offer.pricingPhases.pricingPhaseList.forEach { p ->
                    phases.put(JSObject()
                        .put("formattedPrice", p.formattedPrice)
                        .put("priceAmountMicros", p.priceAmountMicros)
                        .put("priceCurrencyCode", p.priceCurrencyCode)
                        .put("billingPeriod", p.billingPeriod)
                        .put("billingCycleCount", p.billingCycleCount)
                        .put("recurrenceMode", p.recurrenceMode))
                }
                val recurring = offer.pricingPhases.pricingPhaseList.lastOrNull { it.priceAmountMicros > 0L }
                val trial = offer.pricingPhases.pricingPhaseList.firstOrNull { it.priceAmountMicros == 0L }
                call.resolve(JSObject()
                    .put("productId", pd.productId)
                    .put("title", pd.title)
                    .put("offerToken", offer.offerToken)
                    .put("basePlanId", offer.basePlanId)
                    .put("offerId", offer.offerId)
                    .put("formattedPrice", recurring?.formattedPrice)
                    .put("billingPeriod", recurring?.billingPeriod)
                    .put("trialPeriod", trial?.billingPeriod)
                    .put("phases", phases))
            }
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId") ?: DEFAULT_PRODUCT
        val accountId = call.getString("accountId")
        if (accountId.isNullOrBlank() || accountId.length > 64) {
            call.reject("accountId (KoreX user id, ≤64 chars) is required", "INVALID_ACCOUNT")
            return
        }
        if (pendingPurchase != null) {
            call.reject("A purchase is already in progress", "IN_PROGRESS")
            return
        }
        connected(call) {
            loadDetails(call, productId) { pd ->
                val offer = chosenOffer(pd)
                val act = activity
                if (offer == null || act == null) {
                    call.reject("No offer for $productId", "PRODUCT_NOT_FOUND")
                    return@loadDetails
                }
                val params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(pd).setOfferToken(offer.offerToken).build()))
                    .setObfuscatedAccountId(accountId) // the backend checks it equals the requester
                    .build()
                pendingPurchase = call
                act.runOnUiThread {
                    val launch = billing.launchBillingFlow(act, params)
                    if (launch.responseCode != BillingResponseCode.OK) {
                        pendingPurchase = null
                        reject(call, launch)
                    }
                }
            }
        }
    }

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        connected(call) {
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()) { result, purchases ->
                if (result.responseCode != BillingResponseCode.OK) return@queryPurchasesAsync reject(call, result)
                val list = JSArray()
                purchases.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }.forEach { list.put(purchaseJson(it)) }
                call.resolve(JSObject().put("purchases", list))
            }
        }
    }

    /** Backup only: the server acknowledges after granting; the app calls this if it answered acknowledged=false. */
    @PluginMethod
    fun acknowledge(call: PluginCall) {
        val token = call.getString("purchaseToken")
        if (token.isNullOrBlank()) return call.reject("purchaseToken is required", "INVALID_TOKEN")
        connected(call) {
            billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()) { result ->
                if (result.responseCode == BillingResponseCode.OK) call.resolve(JSObject().put("acknowledged", true)) else reject(call, result)
            }
        }
    }

    private fun purchaseJson(p: Purchase): JSObject = JSObject()
        .put("productId", p.products.firstOrNull())
        .put("purchaseToken", p.purchaseToken)
        .put("packageName", p.packageName)
        .put("acknowledged", p.isAcknowledged)
        .put("state", if (p.purchaseState == Purchase.PurchaseState.PURCHASED) "purchased" else "pending")

    private fun reject(call: PluginCall, result: BillingResult) {
        val code = when (result.responseCode) {
            BillingResponseCode.USER_CANCELED -> "USER_CANCELED"
            BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
            BillingResponseCode.BILLING_UNAVAILABLE, BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingResponseCode.SERVICE_DISCONNECTED, BillingResponseCode.FEATURE_NOT_SUPPORTED -> "BILLING_UNAVAILABLE"
            BillingResponseCode.ITEM_UNAVAILABLE -> "PRODUCT_NOT_FOUND"
            BillingResponseCode.NETWORK_ERROR -> "NETWORK_ERROR"
            else -> "ERROR"
        }
        call.reject(result.debugMessage.ifBlank { code }, code)
    }

    companion object {
        const val EVENT = "purchaseUpdated"
        const val DEFAULT_PRODUCT = "korex_annual"
    }
}
