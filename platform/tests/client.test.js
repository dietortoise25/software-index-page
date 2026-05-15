import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import { QianyiClient, QianyiError } from "../src/sdk/client.js";

describe("QianyiClient", () => {
  afterEach(() => {
    // 确保每个测试间没有残留状态
  });

  it("应该正确初始化", () => {
    const client = new QianyiClient({
      baseUrl: "https://asia.qianyierp.com",
      appId: "myApp",
      appSecret: "mySecret",
    });
    assert.ok(client instanceof QianyiClient);
  });

  it("默认 timeout 应为 30000", () => {
    const client = new QianyiClient({
      baseUrl: "https://test.com",
      appId: "app",
      appSecret: "sec",
    });
    assert.equal(client.timeout, 30000);
  });

  it("应该去除 baseUrl 尾部斜杠", () => {
    const client = new QianyiClient({
      baseUrl: "https://test.com///",
      appId: "app",
      appSecret: "sec",
    });
    assert.equal(client.baseUrl, "https://test.com");
  });

  it("自定义 timeout 应该生效", () => {
    const client = new QianyiClient({
      baseUrl: "https://test.com",
      appId: "app",
      appSecret: "sec",
      timeout: 5000,
    });
    assert.equal(client.timeout, 5000);
  });

  it("QianyiError 不传 raw 时，raw 应为 null", () => {
    const err = new QianyiError("E001", "错误信息");
    assert.equal(err.code, "E001");
    assert.equal(err.message, "错误信息");
    assert.equal(err.raw, null);
  });

  it("QianyiError.name 应为 QianyiError", () => {
    const err = new QianyiError("CODE", "msg");
    assert.equal(err.name, "QianyiError");
  });
});
