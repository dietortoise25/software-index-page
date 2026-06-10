import httpx
import pytest
from models.errors import (
    SourcingError, RetryableError, PermanentError, UnknownError,
    classify_http_status, classify_exception,
)

@pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
def test_retryable_status(code):
    err = classify_http_status(code, "boom")
    assert isinstance(err, RetryableError)

@pytest.mark.parametrize("code", [400, 401, 403])
def test_permanent_status(code):
    err = classify_http_status(code, "bad")
    assert isinstance(err, PermanentError)

def test_unknown_status_is_permanent_like():
    err = classify_http_status(418, "teapot")
    assert isinstance(err, UnknownError)
    assert not isinstance(err, RetryableError)

def test_timeout_exception_is_retryable():
    err = classify_exception(httpx.ConnectTimeout("t"))
    assert isinstance(err, RetryableError)

def test_connect_error_is_retryable():
    err = classify_exception(httpx.ConnectError("c"))
    assert isinstance(err, RetryableError)

def test_all_subclasses_are_sourcing_error():
    assert issubclass(RetryableError, SourcingError)
    assert issubclass(PermanentError, SourcingError)
    assert issubclass(UnknownError, SourcingError)
