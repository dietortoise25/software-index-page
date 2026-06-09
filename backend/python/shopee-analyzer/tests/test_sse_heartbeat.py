"""
SSE 心跳测试 —— 防止帧间静默 >60s 撞穿 nginx 默认 proxy_read_timeout。

慢阻塞调用(如图文核对单货品 ~160s)期间，_run_with_heartbeat 应周期性
产出心跳帧，让 nginx 读超时计时器持续重置，连接不被掐断。

运行: cd backend/python/shopee-analyzer && python -m pytest tests/test_sse_heartbeat.py -v
"""
import asyncio
import time

import pytest


def _drive(agen):
    """同步驱动一个 async generator，收集全部产出。"""
    async def _collect():
        out = []
        async for item in agen:
            out.append(item)
        return out
    return asyncio.run(_collect())


def test_slow_task_emits_heartbeats_before_result():
    """慢任务(0.3s)在 interval=0.1s 下，结果前至少产出 1 个心跳。"""
    from sourcing import _run_with_heartbeat

    def slow():
        time.sleep(0.3)
        return "done"

    async def run():
        loop = asyncio.get_event_loop()
        kinds = []
        result = None
        async for kind, payload in _run_with_heartbeat(loop, slow, interval=0.1):
            kinds.append(kind)
            if kind == "result":
                result = payload
        return kinds, result

    kinds, result = asyncio.run(run())
    assert result == "done"
    assert kinds[-1] == "result"
    assert kinds.count("heartbeat") >= 1, f"慢任务期间未产出心跳: {kinds}"


def test_fast_task_emits_no_heartbeat():
    """瞬时任务在 interval=0.1s 下，不产出多余心跳，直接 result。"""
    from sourcing import _run_with_heartbeat

    def fast():
        return 42

    async def run():
        loop = asyncio.get_event_loop()
        kinds = []
        async for kind, payload in _run_with_heartbeat(loop, fast, interval=0.1):
            kinds.append((kind, payload))
        return kinds

    kinds = asyncio.run(run())
    assert kinds[-1] == ("result", 42)
    assert all(k != "heartbeat" for k, _ in kinds), f"瞬时任务不应有心跳: {kinds}"


def test_heartbeat_sse_frame_is_comment_no_event():
    """心跳 SSE 帧应是注释帧(': ...')，前端 EventSource 自动忽略，不污染业务事件。"""
    from sourcing import _heartbeat_frame

    frame = _heartbeat_frame()
    assert frame.startswith(":"), f"心跳须为 SSE 注释帧: {frame!r}"
    assert frame.endswith("\n\n"), "SSE 帧须以空行结尾"
    assert "event:" not in frame, "心跳帧不应带 event 字段"
