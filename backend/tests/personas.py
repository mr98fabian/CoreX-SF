"""Fixed test personas shared by the concordance tests (misión 17, spec of misión 14 §4).

caso_real_anon: the 2026-11-24 production case ANONYMIZED (amounts scaled by an unpublished factor,
generic names; dates, APRs, frequencies, cuts and recurring/subscription duplicates kept), so the
mechanism of every discrepancy N-01…N-17 is the same.
maria: the public demo persona (routers/demo.MARIA), seeded as /api/demo/seed does.
owner: the owner-like fixture of test_invariantes_numeros.
"""
from datetime import date
from decimal import Decimal as D

from models import Account, CashflowItem, CutHistory, RecurringSubscription, Subscription, Transaction, UserSettings

CASO_REAL_TODAY = date(2026, 11, 24)


def seed_caso_real(s, U):
    acc = [
        ("Tarjeta A", "debt", "2883.81", "28.74", "71.26", 6, 12, "credit_card", None),
        ("Préstamo personal", "debt", "11416.12", "32.30", "413.80", 20, None, "personal_loan", None),
        ("Auto", "debt", "19156.25", "20.29", "801.40", 11, None, "auto_loan", None),
        ("Tarjeta B", "debt", "1476.88", "26.99", "31.25", 26, 1, "credit_card", "4750.00"),
        ("Tarjeta C", "debt", "364.49", "27.74", "31.25", 4, 8, "credit_card", "1250.00"),
        ("Tarjeta D", "debt", "73.86", "25.49", "31.25", None, 1, "credit_card", "625.00"),
        ("Tarjeta E", "debt", "0.00", "0.00", "13.69", 18, 21, "credit_card", "875.00"),
        ("Tarjeta F", "debt", "0.00", "29.99", "31.25", 19, 22, "credit_card", "1875.00"),
        ("Tarjeta G", "debt", "39.22", "27.74", "31.25", None, None, "credit_card", "937.50"),
        ("Cheques", "cash", "4803.20", "0.00", "0.00", None, None, "credit_card", None),
    ]
    ids = {}
    for n, t, b, r, m, due, cl, sub, lim in acc:
        a = Account(user_id=U, name=n, type=t, balance=D(b), interest_rate=D(r), min_payment=D(m), due_day=due,
                    closing_day=cl, debt_subtype=sub, credit_limit=D(lim) if lim else None,
                    interest_type="fixed" if sub in ("auto_loan", "personal_loan") else "revolving")
        s.add(a)
        s.flush()
        ids[n] = a.id
    cf = [("Nómina", "2812.50", True, "weekly", 1, 4), ("Ingreso 2", "625.00", True, "monthly", 1, None),
          ("Ingreso 3", "430.00", True, "monthly", 1, None), ("Renta 1", "625.00", False, "monthly", 1, None),
          ("Renta 2", "675.00", False, "monthly", 1, None), ("Telefonía", "1295.00", False, "monthly", 1, None),
          ("Comida", "1250.00", False, "monthly", 1, None), ("Suscripciones (varias)", "412.50", False, "monthly", 1, None),
          ("Seguro", "48.01", False, "monthly", 1, None), ("Gimnasio 1", "34.10", False, "monthly", 1, None),
          ("Gimnasio 2 (en cancelación)", "56.25", False, "monthly", 1, None), ("Internet", "107.50", False, "monthly", 1, None),
          ("Crédito 1", "34.84", False, "monthly", 1, None), ("Crédito 2", "35.38", False, "monthly", 1, None),
          ("Crédito 3", "43.75", False, "monthly", 1, None), ("Crédito 4", "13.75", False, "monthly", 1, None)]
    for n, a, inc, f, dom, dow in cf:
        s.add(CashflowItem(user_id=U, name=n, amount=D(a), is_income=inc, category="Ingreso" if inc else "Gasto",
                           frequency=f, day_of_month=dom, day_of_week=dow))
    subs = [("Gimnasio 2", "56.25", "active", "2026-12-02"), ("Internet", "108.11", "active", "2026-11-27"),
            ("Video", "36.52", "active", "2026-11-11"), ("Compras", "20.29", "active", "2026-11-08"),
            ("Servicio 1", "6.25", "active", "2026-11-30"), ("Streaming", "12.49", "active", "2026-12-05"),
            ("Nube", "26.64", "active", "2026-11-15"), ("Servicio 2", "4.05", "active", "2026-11-27"),
            ("Buzón", "12.49", "active", "2026-12-05"), ("Gimnasio 1", "33.89", "active", "2026-11-19"),
            ("Seguro", "48.01", "active", "2026-11-08"), ("IA", "25.00", "active", "2026-11-21"),
            ("Telefonía", "1294.99", "active", "2026-11-25"), ("Crédito 1", "32.75", "active", "2026-11-21"),
            ("Crédito 2", "36.42", "active", "2026-11-23"), ("Crédito 4", "13.69", "active", "2026-11-25"),
            ("Cancelada 1", "12.16", "cancelled", "2026-12-01"), ("Cancelada 2", "43.75", "cancelled", "2026-11-24")]
    for n, a, st, nx in subs:
        s.add(RecurringSubscription(user_id=U, name=n, amount=D(a), frequency="monthly", status=st, next_charge_date=nx))
    s.add(UserSettings(user_id=U, shield_target=D("1000"), attack_percentage=D("20")))
    for name, cut in (("Tarjeta C", date(2026, 11, 8)), ("Tarjeta B", date(2026, 11, 1)), ("Tarjeta D", date(2026, 11, 1))):
        s.add(CutHistory(user_id=U, account_id=ids[name], cut_date=cut, reported_balance=D("0")))
    s.add(Transaction(user_id=U, account_id=ids["Préstamo personal"], date="2026-11-20", amount=D("413.80"),
                      description="pago", category="payment"))
    s.add(Transaction(user_id=U, account_id=ids["Tarjeta A"], date="2026-11-06", amount=D("2214.25"),
                      description="pago", category="payment"))


def seed_maria(s, U):
    from routers.demo import MARIA
    for n, t, b, r, m, due, cl, _vt, it, sub, *_rest, lim in MARIA["accounts"]:
        s.add(Account(user_id=U, name=n, type=t, balance=D(str(b)), interest_rate=D(str(r)), min_payment=D(str(m)),
                      due_day=due, closing_day=cl, debt_subtype=sub, interest_type=it,
                      credit_limit=D(str(lim)) if lim else None))
    for n, a, cat, f, var, dom, dow, moy in MARIA["cashflows"]:
        s.add(CashflowItem(user_id=U, name=n, amount=D(str(a)), category=cat, is_income=cat == "income", frequency=f,
                           is_variable=var, day_of_month=dom, day_of_week=dow, month_of_year=moy))


def seed_owner(s, U):
    s.add(Account(user_id=U, name="Chase Checking", type="checking", balance=D("1915.32")))
    for name, bal, apr, mn, sub, due, close in (
            ("Upstart", "9463.94", "32.30", "380", "personal_loan_revolving", 3, None),
            ("Amex Gold", "1679.27", "28.74", "99.96", "credit_card", 7, 12),
            ("Chase 2323", "34.23", "24.99", "10.95", "credit_card", 18, 21),
            ("Fortiva", "93.08", "29.99", "25", "credit_card", 14, 22),
            ("Toyota", "15325.00", "20.29", "641.12", "auto_loan", 11, None)):
        s.add(Account(user_id=U, name=name, type="debt", balance=D(bal), interest_rate=D(apr), min_payment=D(mn),
                      debt_subtype=sub, interest_type="fixed" if sub == "auto_loan" else "revolving",
                      due_day=due, closing_day=close))
    for name, amount, freq, inc in (("Nómina", "4500", "semi_monthly", True), ("Renta", "1800", "monthly", False),
                                    ("AT&T", "1036", "monthly", False), ("Súper", "125", "weekly", False),
                                    ("Gasolina", "60", "biweekly", False), ("Seguro", "642.18", "annually", False)):
        s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency=freq, is_income=inc,
                           category="income" if inc else "expense", day_of_month=1))
    for name, amount, freq, status in (("AT&T", "1035.99", "monthly", "active"), ("Netflix", "15.49", "monthly", "active"),
                                       ("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active"),
                                       ("Disney", "13.99", "monthly", "cancelled")):
        s.add(RecurringSubscription(user_id=U, name=name, amount=D(amount), frequency=freq, status=status))


PERSONAS = {
    "caso_real": ("c0c0c0c0-0000-4000-a000-00000000c001", seed_caso_real),
    "maria": ("c0c0c0c0-0000-4000-a000-00000000c002", seed_maria),
    "owner": ("c0c0c0c0-0000-4000-a000-00000000c003", seed_owner),
}


def seed(s, key):
    U, fn = PERSONAS[key]
    s.add(Subscription(user_id=U, plan="accelerator", status="active"))
    fn(s, U)
    s.commit()
    return U
