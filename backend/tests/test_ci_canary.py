"""Rama desechable (misión 2026-11-22-ci-bloqueo): un test roto a propósito para probar que
el CI en rojo bloquea el merge. Esta rama se borra tras la prueba."""


def test_roto_a_proposito():
    assert 1 == 2, "roto a propósito: el merge debe quedar bloqueado"
