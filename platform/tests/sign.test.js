import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { generateSign } from "../src/sdk/utils/sign.js";

describe("generateSign", () => {
  it("生成正确的 MD5 签名", () => {
    const params = {
      appId: "test123",
      bizParam: '{"page":1}',
      serviceType: "testService",
      timestamp: 1700000000000,
      appSecret: "mySecret",
    };
    const expected = crypto
      .createHash("md5")
      .update("appId=test123bizParam={\"page\":1}serviceType=testServicetimestamp=1700000000000mySecret", "utf-8")
      .digest("hex");

    assert.equal(generateSign(params), expected);
  });

  it("不同参数生成不同签名", () => {
    const sig1 = generateSign({
      appId: "a", bizParam: "{}", serviceType: "s", timestamp: 1, appSecret: "sec",
    });
    const sig2 = generateSign({
      appId: "b", bizParam: "{}", serviceType: "s", timestamp: 1, appSecret: "sec",
    });
    assert.notEqual(sig1, sig2);
  });

  it("包含中文字符的 bizParam 也能正确签名", () => {
    const sig = generateSign({
      appId: "app",
      bizParam: '{"name":"测试"}',
      serviceType: "sku",
      timestamp: 1700000000000,
      appSecret: "secret",
    });
    assert.equal(typeof sig, "string");
    assert.equal(sig.length, 32); // MD5 hex is 32 chars
  });

  it("签名始终为 32 位十六进制字符串", () => {
    const sig = generateSign({
      appId: "x", bizParam: "y", serviceType: "z", timestamp: 0, appSecret: "w",
    });
    assert.equal(typeof sig, "string");
    assert.match(sig, /^[a-f0-9]{32}$/);
  });

  it("空字符串参数也能正常签名", () => {
    const sig = generateSign({
      appId: "", bizParam: "", serviceType: "", timestamp: 0, appSecret: "",
    });
    assert.equal(typeof sig, "string");
    assert.equal(sig.length, 32);
  });
});
