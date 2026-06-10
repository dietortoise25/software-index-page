"""选品比价错误分类体系。client 层把原始 HTTP 状态/异常翻译成这三类之一。"""
import httpx

class SourcingError(Exception):
    """所有选品错误的基类。"""
    def __init__(self, message: str, code: str = "", status: int | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status

class RetryableError(SourcingError):
    """可恢复:超时/连接失败/429/5xx/流中断 → tenacity 重试。"""

class PermanentError(SourcingError):
    """不可恢复:400/401/403/余额不足/业务规则 → 立即失败,不重试。"""

class UnknownError(SourcingError):
    """未分类 → 记日志,保守失败(按不可恢复处理,不无限重试)。"""

_RETRYABLE = {429, 500, 502, 503, 504}
_PERMANENT = {400, 401, 403}

def classify_http_status(status: int, message: str) -> SourcingError:
    if status in _RETRYABLE:
        return RetryableError(message, code=f"HTTP_{status}", status=status)
    if status in _PERMANENT:
        return PermanentError(message, code=f"HTTP_{status}", status=status)
    return UnknownError(message, code=f"HTTP_{status}", status=status)

def classify_exception(exc: Exception) -> SourcingError:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError,
                        httpx.RemoteProtocolError)):
        return RetryableError(str(exc), code="NETWORK")
    if isinstance(exc, SourcingError):
        return exc
    return UnknownError(str(exc), code="UNKNOWN")
