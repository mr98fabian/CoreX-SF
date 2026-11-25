"""Misión 14 — sonda de concordancia. Solo lectura del motor: siembra una SQLite en
memoria con cada persona y vuelca, de una vez, cada número por su función real."""
import os, sys, json, calendar
from datetime import date, timedelta
from decimal import Decimal as D

os.environ["ENVIRONMENT"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.path.insert(0, os.getcwd())

from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool
import database
eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
database.engine = eng
import models
from models import Account, CashflowItem, RecurringSubscription, UserSettings, CutHistory, Transaction
SQLModel.metadata.create_all(eng)

import helpers as H
import velocity_engine as V

TODAY = date(2026, 11, 24)
q = lambda x: D(str(x)).quantize(D("0.01"))


def seed_caso_real(s, U):
    """Caso real del 2026-11-24, ANONIMIZADO: montos escalados por un factor no publicado y
    nombres genéricos. Se conservan fechas, APR, frecuencias, cortes y los duplicados
    recurrente/suscripción, así que el mecanismo de cada discrepancia es el mismo."""
    acc = [
        (2861, 'Tarjeta A', 'debt', '2883.81', '28.74', '71.26', 6, 12, 'credit_card', None),
        (2862, 'Préstamo personal', 'debt', '11416.12', '32.30', '413.80', 20, None, 'personal_loan', None),
        (2863, 'Auto', 'debt', '19156.25', '20.29', '801.40', 11, None, 'auto_loan', None),
        (2864, 'Tarjeta B', 'debt', '1476.88', '26.99', '31.25', 26, 1, 'credit_card', '4750.00'),
        (2865, 'Tarjeta C', 'debt', '364.49', '27.74', '31.25', 4, 8, 'credit_card', '1250.00'),
        (2866, 'Tarjeta D', 'debt', '73.86', '25.49', '31.25', None, 1, 'credit_card', '625.00'),
        (2867, 'Tarjeta E', 'debt', '0.00', '0.00', '13.69', 18, 21, 'credit_card', '875.00'),
        (2868, 'Tarjeta F', 'debt', '0.00', '29.99', '31.25', 19, 22, 'credit_card', '1875.00'),
        (2869, 'Tarjeta G', 'debt', '39.22', '27.74', '31.25', None, None, 'credit_card', '937.50'),
        (2870, 'Cheques', 'cash', '4803.20', '0.00', '0.00', None, None, 'credit_card', None),
    ]
    for i, n, t, b, r, m, due, cl, sub, lim in acc:
        s.add(Account(id=i, user_id=U, name=n, type=t, balance=D(b), interest_rate=D(r), min_payment=D(m), due_day=due,
                      closing_day=cl, debt_subtype=sub, credit_limit=D(lim) if lim else None))
    cf = [('Nómina', '2812.50', True, 'weekly', 1, 4),
          ('Ingreso 2', '625.00', True, 'monthly', 1, None),
          ('Ingreso 3', '430.00', True, 'monthly', 1, None),
          ('Renta 1', '625.00', False, 'monthly', 1, None),
          ('Renta 2', '675.00', False, 'monthly', 1, None),
          ('Telefonía', '1295.00', False, 'monthly', 1, None),
          ('Comida', '1250.00', False, 'monthly', 1, None),
          ('Suscripciones (varias)', '412.50', False, 'monthly', 1, None),
          ('Seguro', '48.01', False, 'monthly', 1, None),
          ('Gimnasio 1', '34.10', False, 'monthly', 1, None),
          ('Gimnasio 2 (en cancelación)', '56.25', False, 'monthly', 1, None),
          ('Internet', '107.50', False, 'monthly', 1, None),
          ('Crédito 1', '34.84', False, 'monthly', 1, None),
          ('Crédito 2', '35.38', False, 'monthly', 1, None),
          ('Crédito 3', '43.75', False, 'monthly', 1, None),
          ('Crédito 4', '13.75', False, 'monthly', 1, None)]
    for n, a, inc, f, dom, dow in cf:
        s.add(CashflowItem(user_id=U, name=n, amount=D(a), is_income=inc, category="Ingreso" if inc else "Gasto",
                           frequency=f, day_of_month=dom, day_of_week=dow))
    subs = [('Gimnasio 2', '56.25', 'active', '2026-12-02'),
            ('Internet', '108.11', 'active', '2026-11-27'),
            ('Video', '36.52', 'active', '2026-11-11'),
            ('Compras', '20.29', 'active', '2026-11-08'),
            ('Servicio 1', '6.25', 'active', '2026-11-30'),
            ('Streaming', '12.49', 'active', '2026-12-05'),
            ('Nube', '26.64', 'active', '2026-11-15'),
            ('Servicio 2', '4.05', 'active', '2026-11-27'),
            ('Buzón', '12.49', 'active', '2026-12-05'),
            ('Gimnasio 1', '33.89', 'active', '2026-11-19'),
            ('Seguro', '48.01', 'active', '2026-11-08'),
            ('IA', '25.00', 'active', '2026-11-21'),
            ('Telefonía', '1294.99', 'active', '2026-11-25'),
            ('Crédito 1', '32.75', 'active', '2026-11-21'),
            ('Crédito 2', '36.42', 'active', '2026-11-23'),
            ('Crédito 4', '13.69', 'active', '2026-11-25'),
            ('Cancelada 1', '12.16', 'cancelled', '2026-12-01'),
            ('Cancelada 2', '43.75', 'cancelled', '2026-11-24')]
    for n, a, st, nx in subs:
        s.add(RecurringSubscription(user_id=U, name=n, amount=D(a), frequency="monthly", status=st, next_charge_date=nx))
    s.add(UserSettings(user_id=U, shield_target=D("1000"), attack_percentage=D("20")))
    for a, c in ((2865, date(2026, 11, 8)), (2864, date(2026, 11, 1)), (2866, date(2026, 11, 1))):
        s.add(CutHistory(user_id=U, account_id=a, cut_date=c, reported_balance=D("0")))
    for a, d, amt in [(2862, '2026-11-20', '413.80'), (2861, '2026-11-06', '2214.25')]:
        s.add(Transaction(user_id=U, account_id=a, date=d, amount=D(amt), description="pago", category="payment"))


def seed_maria(s, U):
    from routers.demo import MARIA
    for n, t, b, r, m, due, cl, _vt, _it, sub, *_rest, lim in MARIA["accounts"]:
        s.add(Account(user_id=U, name=n, type=t, balance=D(str(b)), interest_rate=D(str(r)), min_payment=D(str(m)),
                      due_day=due, closing_day=cl, debt_subtype=sub, credit_limit=D(str(lim)) if lim else None))
    for n, a, cat, f, var, dom, dow, moy in MARIA["cashflows"]:
        s.add(CashflowItem(user_id=U, name=n, amount=D(str(a)), category=cat, is_income=cat == "income", frequency=f,
                           day_of_month=dom, day_of_week=dow, month_of_year=moy))


def seed_owner_inv(s, U):  # tests/test_invariantes_numeros.py::owner
    s.add(Account(user_id=U, name="Chase Checking", type="checking", balance=D("1915.32")))
    for name, bal, apr, mn, sub, due, close in (
            ("Upstart", "9463.94", "32.30", "380", "personal_loan_revolving", 3, None),
            ("Amex Gold", "1679.27", "28.74", "99.96", "credit_card", 7, 12),
            ("Chase 2323", "34.23", "24.99", "10.95", "credit_card", 18, 21),
            ("Fortiva", "93.08", "29.99", "25", "credit_card", 14, 22),
            ("Toyota", "15325.00", "20.29", "641.12", "auto_loan", 11, None)):
        s.add(Account(user_id=U, name=name, type="debt", balance=D(bal), interest_rate=D(apr), min_payment=D(mn),
                      debt_subtype=sub, due_day=due, closing_day=close))
    for name, amount, freq, inc in (("Nómina", "4500", "semi_monthly", True), ("Renta", "1800", "monthly", False),
                                    ("AT&T", "1036", "monthly", False), ("Súper", "125", "weekly", False),
                                    ("Gasolina", "60", "biweekly", False), ("Seguro", "642.18", "annually", False)):
        s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency=freq, is_income=inc,
                           category="income" if inc else "expense", day_of_month=1))
    for name, amount, freq, status in (("AT&T", "1035.99", "monthly", "active"), ("Netflix", "15.49", "monthly", "active"),
                                       ("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active"),
                                       ("Disney", "13.99", "monthly", "cancelled")):
        s.add(RecurringSubscription(user_id=U, name=name, amount=D(amount), frequency=freq, status=status))


def audit(label, U, today, verbose=False):
    out = {"persona": label, "hoy": today.isoformat()}
    with Session(eng) as s:
        accounts = s.exec(select(Account).where(Account.user_id == U)).all()
        active = H.filter_active_debt_accounts(accounts, None)
        debts = H.accounts_to_active_debt_objects(accounts, None)
        liquid = D(str(H.get_liquid_cash(accounts)))
        shield, pct = H.get_plan_settings(s, U)
        total = sum((a.balance for a in active), D("0"))
        out["deuda_total"] = str(q(total)); out["liquido"] = str(q(liquid)); out["escudo"] = str(shield)

        # interés diario: motor vs suma manual
        di = V.daily_interest(active)["total"]
        manual = sum((D(str(a.balance)) * D(str(a.interest_rate)) / D("36500") for a in active), D("0"))
        shown = q(di.quantize(D("0.01"), rounding="ROUND_HALF_UP"))
        per = V.interest_periods(shown)
        out["interes"] = {"dia_motor": str(di.quantize(D("0.0001"))), "dia_manual": str(manual.quantize(D("0.0001"))),
                          "dia": str(shown), "semana": str(q(per["semana"])), "mes": str(q(per["mes"])), "anio": str(q(per["anio"])),
                          "anio_sin_redondear_dia": str(q(di * 365))}

        # resumen mensual / excedente
        cs = H.cashflow_summary_for(s, U, None)
        out["cashflow_summary"] = {k: (str(v) if isinstance(v, D) else v) for k, v in cs.items()}
        data = H.load_cashflow_inputs(s, U)
        surplus = V.monthly_surplus(data["tuples"], debts, data["subscriptions"])
        velocity = V.monthly_attack(surplus, liquid, pct)
        out["aporte_mensual_plan"] = str(velocity)
        out["plan_minimum"] = {d.name: str(q(V.plan_minimum(d))) for d in debts}

        # misión
        m = H.build_daily_mission(s, U, accounts, None, today=today)
        out["mision"] = {"reserva": str(m["reserva"]), "ataque": str(m["ataque"]), "objetivo": m["objetivo"],
                         "mision": (m["mision"] or {}).get("copy"), "faltante": (m["faltante"] or {}).get("copy"),
                         "obligaciones": [(o["tipo"], o["cuenta"], str(q(o["monto"])), o["fecha_accion"].isoformat(), o["fecha_evento"].isoformat()) for o in m["obligaciones"]]}
        eom = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
        out["mision"]["obligaciones_hasta_fin_de_mes"] = str(q(sum((o["monto"] for o in m["obligaciones"] if o["fecha_accion"] <= eom), D("0"))))

        # plan mensual + serie diaria (Calendario)
        ds = V.daily_series(debts, velocity, is_payday=H.payday_rule(data["items"]), today=today)
        tl = ds["timeline"]
        pts = ds["daily_series"]
        month_pts = [p for p in pts if p["date"][:7] == today.isoformat()[:7]]
        out["calendario"] = {"inicio_mes": pts[0]["total_balance"], "cierre_mes": tl[0]["total_balance"] if tl else 0,
                             "bajas": round(pts[0]["total_balance"] - (tl[0]["total_balance"] if tl else 0), 2),
                             "puntos_mes": [(p["date"][8:], p["total_balance"]) for p in month_pts],
                             "fecha_libre": ds["freedom_date"], "meses": ds["total_months"], "interes_total_plan": ds["total_interest_paid"],
                             "interes_mes0": tl[0]["interest_paid"] if tl else 0}
        # flujos del mes 0 por deuda
        key = V._sim_key(debts, velocity, True, False, today)
        import time
        _, flows = V._simulate_cached(key, time.monotonic(), debts, velocity, True, False, today)
        live = [d for d in debts if d.balance > 0]
        out["calendario"]["flujos_mes0"] = [(live[i].name, str(a), str(b), str(c)) for i, a, b, c in flows[0][1]] if flows else []

        # eventos del calendario
        cm = H.calendar_month(s, U, today.year, today.month, None, today=today)
        out["calendario_eventos"] = {"total_mes_sale": str(cm["total_mes_sale"]), "total_mes_entra": str(cm["total_mes_entra"]),
                                     "sale_desde_hoy": str(sum((d["total_sale"] for d in cm["dias"] if d["dia"] >= today.day), D("0"))),
                                     "sale_ya_pasado": str(sum((d["total_sale"] for d in cm["dias"] if d["dia"] < today.day), D("0"))),
                                     "minimos_del_mes": str(sum((c["monto"] for d in cm["dias"] for c in d["cobros"] if c["tipo"] == "minimo"), D("0"))),
                                     "deudas_sin_fecha": cm["deudas_sin_fecha"]}

        # comparación (Inicio / Plan)
        cp = V.compare_paths(debts, velocity, start=today)
        out["compare"] = {"deuda_hoy": str(cp["deuda_hoy"]), "estado": cp["estado"],
                          "plan": cp["plan"] and {k: str(cp["plan"][k]) for k in ("meses", "fecha_libre", "interes_total", "aporte_mensual")},
                          "minimos": cp["minimos"] and {k: str(cp["minimos"][k]) for k in ("meses", "fecha_libre", "interes_total")},
                          "ahorro": {k: str(v) for k, v in cp["ahorro"].items()}}
        if cp["plan"]:
            out["compare"]["pagaras_plan"] = str(q(cp["deuda_hoy"] + cp["plan"]["interes_total"]))
            out["compare"]["pagaras_minimos"] = str(q(cp["deuda_hoy"] + cp["minimos"]["interes_total"]))
        pr = V.get_projections(debts, liquid, pct, extra_monthly=surplus)
        out["projections"] = {k: pr[k] for k in ("total_debt", "total_min_payments", "velocity_power", "velocity_debt_free_date",
                                                 "standard_debt_free_date", "months_saved", "interest_saved", "velocity_interest")}

        # GPS táctico (misión proyectada día a día)
        macc = H.mission_accounts_for(s, U, active, today)
        inc, exp = H.dated_cashflow(s, U, today, 62 + 1 + V.MISSION_WINDOW_DAYS)
        mv = V.generate_action_plan(macc, inc, exp, liquid, "Checking", shield, [], start=today, days=62)
        paid_by = {}
        for x in mv:
            if x["type"] in ("obligation", "min_payment", "attack", "velocity_chunk"):
                paid_by.setdefault(x["date"][:7], D("0"))
                paid_by[x["date"][:7]] += D(str(x["amount"]))
        this_month = today.isoformat()[:7]
        out["gps"] = {"pagos_a_deuda_por_mes": {k: str(v) for k, v in paid_by.items()},
                      "deuda_cierre_mes_sin_interes": str(q(total - paid_by.get(this_month, D("0")))),
                      "movs_mes": [(x["date"][5:], x["type"], x["destination"] if x["type"] != "income" else x["source"], x["amount"])
                                   for x in mv if x["date"][:7] == this_month and x["type"] not in ("income", "expense")],
                      "faltantes": [(x["date"][5:], x["destination"], x["amount"]) for x in mv if x["type"] == "faltante"][:6],
                      "primer_ataque": next(((x["date"], x["destination"], x["amount"]) for x in mv if x["type"] == "attack"), None),
                      "caja_min": min((x["funding_balance_after"] for x in mv), default=None)}
        # cierre de mes "realista": pagos del GPS + interés prorrateado de los días restantes
        rest_days = (eom - today).days
        out["cierre_realista"] = str(q(total - paid_by.get(this_month, D("0")) + di * rest_days))
        # proyección de caja (/cashflow/projection) y safe equity del panel
        safe = V.calculate_safe_attack_equity(liquid, shield, debts, recurring_incomes=inc, recurring_expenses=exp, start_date=today)
        out["safe_equity_panel"] = {"safe": str(q(safe["safe_equity"])), "reserved": str(q(safe["reserved_for_bills"])), "msg": safe["message"]}
    return out


PERSONAS = [("caso_real_anon_2026-11-24", "a0000000-0000-4000-a000-0000000000f1", seed_caso_real),
            ("maria_demo", "a0000000-0000-4000-a000-0000000000d1", seed_maria),
            ("owner_invariantes", "a0000000-0000-4000-a000-0000000000b1", seed_owner_inv)]
res = []
for label, U, seed in PERSONAS:
    with Session(eng) as s:
        seed(s, U); s.commit()
    res.append(audit(label, U, TODAY))
# sensibilidad: el mismo usuario el día 1 y el 24 (¿el Calendario depende del día?)
def fantasma(U, today):
    import calendar as _c
    with Session(eng) as s:
        accounts = s.exec(select(Account).where(Account.user_id == U)).all()
        debts = H.accounts_to_active_debt_objects(accounts, None)
        data = H.load_cashflow_inputs(s, U)
        liquid = D(str(H.get_liquid_cash(accounts))); _, pct = H.get_plan_settings(s, U)
        vel = V.monthly_attack(V.monthly_surplus(data["tuples"], debts, data["subscriptions"]), liquid, pct)
        n = _c.monthrange(today.year, today.month)[1]
        rule = H.payday_rule(data["items"])
        pays = [d for d in range(1, n + 1) if rule(today.replace(day=d))]
        past = [d for d in pays if d < today.day]; fut = [d for d in pays if d >= today.day]
        mins_paid = sum((V.plan_minimum(d) for d in debts if d.due_day and d.due_day < today.day), D("0"))
        mins_rest = sum((V.plan_minimum(d) for d in debts if not (d.due_day and d.due_day < today.day) and d.debt_subtype in V.FIXED_SUBTYPES + ("",) or (d.debt_subtype == "credit_card" and not (d.due_day and d.due_day < today.day))), D("0"))
        return {"aporte": str(vel), "dias_pago": pays, "excedente_dias_pasados": str(q(vel * len(past) / len(pays))),
                "excedente_dias_futuros": str(q(vel * len(fut) / len(pays))), "minimos_ya_pagados": str(q(mins_paid)),
                "minimos_restantes": str(q(mins_rest))}


res.append({"fantasma_caso_real": fantasma(PERSONAS[0][1], TODAY)})
res.append({"sensibilidad_caso_real_por_dia": {d.isoformat(): audit("f", PERSONAS[0][1], d)["calendario"]["bajas"] for d in (date(2026, 11, 1), date(2026, 11, 15), date(2026, 11, 24), date(2026, 11, 30))}})
print(json.dumps(res, indent=1, ensure_ascii=False, default=str))
