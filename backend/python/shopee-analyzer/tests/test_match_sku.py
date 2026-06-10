import httpx
import json
import pytest
from clients.llm_client import match_sku
from models.errors import RetryableError

_VALID = ('{"matched_sku_id":"7","confidence":0.9,"reason":"贴合",'
          '"scores":{"price":80,"semantic_match":90,"image_match":50,"supply":70},'
          '"overall_score":85}')

def _sse(text):
    return (f'data: {{"choices":[{{"delta":{{"content":{json.dumps(text)}}}}}]}}\n\n'
            "data: [DONE]\n\n").encode()

def test_match_sku_parses_structured():
    def handler(req):
        return httpx.Response(200, content=_sse(_VALID),
                              headers={"content-type": "text/event-stream"})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    shopee = {"name": "手机壳", "category": "配件", "price_brl": 10.0}
    cand = {"item_id": "7", "title": "硅胶壳", "image_confidence": 0.6,
            "sku": {"items": [{"sku_id": 7, "full_spec": "黑色", "price": "3.5", "can_book_count": 100}]}}
    result, raw = match_sku(client, shopee, cand, api_key="k", base_url="http://t/v1",
                            model="gpt-5.5", max_wait=0)
    assert str(result.matched_sku_id) == "7"
    assert result.overall_score == 85

def test_match_sku_bad_json_retries_then_fails():
    def handler(req):
        return httpx.Response(200, content=_sse("not json at all"),
                              headers={"content-type": "text/event-stream"})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(RetryableError):
        match_sku(client, {"name": "x"}, {"item_id": "1", "sku": {"items": [{"sku_id": 1}]}},
                  api_key="k", base_url="http://t/v1", model="m", attempts=2, max_wait=0)
