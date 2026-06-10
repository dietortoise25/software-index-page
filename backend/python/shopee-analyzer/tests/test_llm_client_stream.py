import httpx
from clients.llm_client import stream_chat

def _sse_stream(chunks):
    body = ""
    for c in chunks:
        body += f'data: {{"choices":[{{"delta":{{"content":"{c}"}}}}]}}\n\n'
    body += "data: [DONE]\n\n"
    return body.encode("utf-8")

def test_stream_accumulates_and_emits_tokens():
    def handler(req):
        return httpx.Response(200, content=_sse_stream(["He", "llo"]),
                              headers={"content-type": "text/event-stream"})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    tokens = []
    full = stream_chat(client, model="gpt-5.5", messages=[{"role":"user","content":"hi"}],
                       api_key="k", base_url="http://t/v1",
                       on_token=tokens.append)
    assert full == "Hello"
    assert tokens == ["He", "llo"]
