"""
CoreX Financial System — Structured Exception Hierarchy

Usage in routers:
    from exceptions import NotFoundError, ValidationError, ConflictError

    raise NotFoundError("Account", account_id)
    raise ValidationError("Amount must be positive", details={"field": "amount"})
    raise ConflictError("Account name already exists")
"""
from typing import Optional, Any


class CoreXError(Exception):
    """Base exception for all CoreX business errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class NotFoundError(CoreXError):
    """Resource not found (404)."""

    def __init__(self, resource: str, resource_id: Any = None):
        detail = f"{resource} not found"
        if resource_id is not None:
            detail = f"{resource} with id={resource_id} not found"
        super().__init__(
            message=detail,
            status_code=404,
            error_code="NOT_FOUND",
            details={"resource": resource, "id": str(resource_id) if resource_id else None},
        )


class ValidationError(CoreXError):
    """Input validation failed (422)."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(
            message=message,
            status_code=422,
            error_code="VALIDATION_ERROR",
            details=details or {},
        )


class ConflictError(CoreXError):
    """Duplicate / conflict (409)."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(
            message=message,
            status_code=409,
            error_code="CONFLICT",
            details=details or {},
        )


class RateLimitError(CoreXError):
    """Too many requests (429)."""

    def __init__(self, message: str = "Too many requests. Please retry later.", retry_after: int = 60):
        super().__init__(
            message=message,
            status_code=429,
            error_code="RATE_LIMITED",
            details={"retry_after_seconds": retry_after},
        )


class PaymentRequiredError(CoreXError):
    """Feature requires paid subscription (402)."""

    def __init__(self, feature: str, required_plan: str = "velocity"):
        super().__init__(
            message=f"'{feature}' requires the {required_plan} plan or higher.",
            status_code=402,
            error_code="PAYMENT_REQUIRED",
            details={"feature": feature, "required_plan": required_plan},
        )
