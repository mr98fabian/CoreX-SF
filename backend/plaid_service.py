"""
Plaid API Service for KoreX Financial System.
Handles bank account linking and transaction syncing.
"""
import os
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

load_dotenv()

# --- Plaid Client Configuration ---
def get_plaid_client():
    """Initialize and return Plaid API client."""
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,  # Use Sandbox for testing
        api_key={
            'clientId': os.getenv('PLAID_CLIENT_ID', 'sandbox_client_id'),
            'secret': os.getenv('PLAID_SECRET', 'sandbox_secret'),
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


def create_link_token(user_id: str = "korex_user_001") -> dict:
    """
    Create a Link token for initializing Plaid Link in the frontend.
    
    Args:
        user_id: Unique identifier for the user
        
    Returns:
        dict with link_token and expiration, or error info
    """
    # Check if credentials are configured
    client_id = os.getenv('PLAID_CLIENT_ID', '')
    secret = os.getenv('PLAID_SECRET', '')
    
    if not client_id or client_id == 'sandbox_client_id' or not secret or secret == 'sandbox_secret':
        return {
            "error": True,
            "message": "Plaid credentials not configured. Please add your Plaid Sandbox credentials to backend/.env file. Get free credentials at https://dashboard.plaid.com/signup"
        }
    
    try:
        client = get_plaid_client()
        
        request = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="KoreX Financial System",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=user_id)
        )
        
        response = client.link_token_create(request)
        return {
            "link_token": response.link_token,
            "expiration": str(response.expiration)
        }
    except plaid.ApiException as e:
        return {
            "error": True,
            "message": f"Plaid API error: {e.body}"
        }
    except Exception as e:
        return {
            "error": True,
            "message": f"Error creating link token: {str(e)}"
        }


def exchange_public_token(public_token: str) -> dict:
    """
    Exchange a public token from Plaid Link for an access token.
    
    Args:
        public_token: The public token received from Plaid Link
        
    Returns:
        dict with access_token and item_id
    """
    client = get_plaid_client()
    
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    
    return {
        "access_token": response.access_token,
        "item_id": response.item_id
    }


def get_accounts(access_token: str) -> List[dict]:
    """
    Fetch all accounts associated with an access token.
    
    Args:
        access_token: Plaid access token
        
    Returns:
        List of account dictionaries
    """
    client = get_plaid_client()
    
    request = AccountsGetRequest(access_token=access_token)
    response = client.accounts_get(request)
    
    accounts = []
    for acc in response.accounts:
        accounts.append({
            "plaid_account_id": acc.account_id,
            "name": acc.name,
            "official_name": acc.official_name,
            "type": acc.type.value,
            "subtype": acc.subtype.value if acc.subtype else None,
            "balance": str(acc.balances.current) if acc.balances.current else "0",
            "available": str(acc.balances.available) if acc.balances.available else "0",
            "mask": acc.mask  # Last 4 digits
        })
    
    return accounts


def sync_transactions(access_token: str, cursor: Optional[str] = None) -> dict:
    """
    Sync transactions for an access token using Plaid's Transactions Sync API.
    
    Args:
        access_token: Plaid access token
        cursor: Optional cursor for pagination
        
    Returns:
        dict with added, modified, removed transactions and next_cursor
    """
    if access_token == "current" or access_token == "sandbox" or not os.getenv('PLAID_CLIENT_ID'):
        # Return mock data for demo/testing
        return {
            "added": [
                {
                    "plaid_transaction_id": "tx_mock_001",
                    "plaid_account_id": "acc_checking_123",
                    "amount": 55.20,
                    "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                    "name": "Starbucks Coffee",
                    "merchant_name": "Starbucks",
                    "category": "Food and Drink",
                    "pending": False
                },
                {
                    "plaid_transaction_id": "tx_mock_002",
                    "plaid_account_id": "acc_heloc_456",
                    "amount": 1200.00,
                    "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                    "name": "Mortgage Payment",
                    "merchant_name": "Chase Bank",
                    "category": "Transfer",
                    "pending": False
                }
            ],
            "modified": 0,
            "removed": 0,
            "has_more": False,
            "next_cursor": "mock_cursor_123"
        }

    client = get_plaid_client()
    
    request = TransactionsSyncRequest(
        access_token=access_token,
        cursor=cursor or ""
    )
    response = client.transactions_sync(request)
    
    added = []
    for tx in response.added:
        added.append({
            "plaid_transaction_id": tx.transaction_id,
            "plaid_account_id": tx.account_id,
            "amount": str(tx.amount),
            "date": str(tx.date),
            "name": tx.name,
            "merchant_name": tx.merchant_name,
            "category": tx.category[0] if tx.category else "Uncategorized",
            "pending": tx.pending
        })
    
    return {
        "added": added,
        "modified": len(response.modified),
        "removed": len(response.removed),
        "has_more": response.has_more,
        "next_cursor": response.next_cursor
    }
