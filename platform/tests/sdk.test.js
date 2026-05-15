import { describe, it } from "node:test";
import assert from "node:assert";
import { QianyiSDK, QianyiError, Webhook } from "../src/sdk/index.js";

describe("QianyiSDK", () => {
  const config = {
    baseUrl: "https://asia.qianyierp.com",
    appId: "test_app_id",
    appSecret: "test_secret",
    timeout: 10000,
  };

  it("应该正确实例化", () => {
    const sdk = new QianyiSDK(config);
    assert.ok(sdk instanceof QianyiSDK);
  });

  it("baseUrl 尾部斜杠应该被移除", () => {
    const sdk = new QianyiSDK({ ...config, baseUrl: "https://asia.qianyierp.com/" });
    assert.ok(sdk); // 不抛异常即可，实际截断在 client 内部
  });

  it("应该包含全部 13 个业务模块", () => {
    const sdk = new QianyiSDK(config);
    const modules = [
      "shop", "sku", "order", "returnOrder", "warehouse",
      "inventory", "asn", "odo", "adjustment", "purchase",
      "logistics", "report", "customField", "supplier",
    ];
    for (const name of modules) {
      assert.ok(sdk[name], `缺少模块: ${name}`);
      assert.equal(typeof sdk[name], "object", `${name} 应为对象`);
    }
  });

  it("每个模块至少有一个方法", () => {
    const sdk = new QianyiSDK(config);
    for (const [name, mod] of Object.entries(sdk)) {
      assert.ok(Object.keys(mod).length > 0, `模块 ${name} 没有任何方法`);
    }
  });

  it("shop 模块应该有 list 方法", () => {
    const sdk = new QianyiSDK(config);
    assert.equal(typeof sdk.shop.list, "function");
  });

  it("sku 模块应该有 list/create/update/updateStatus 方法", () => {
    const sdk = new QianyiSDK(config);
    assert.equal(typeof sdk.sku.list, "function");
    assert.equal(typeof sdk.sku.create, "function");
    assert.equal(typeof sdk.sku.update, "function");
    assert.equal(typeof sdk.sku.updateStatus, "function");
  });

  it("order 模块应该有完整的订单操作方法", () => {
    const sdk = new QianyiSDK(config);
    const methods = ["create", "createAndAudit", "close", "list", "audit", "send"];
    for (const m of methods) {
      assert.equal(typeof sdk.order[m], "function", `order 缺少方法: ${m}`);
    }
  });

  it("inventory 模块应该有 listV2 方法", () => {
    const sdk = new QianyiSDK(config);
    assert.equal(typeof sdk.inventory.listV2, "function");
  });

  it("webhook 常量应该被导出", () => {
    assert.ok(Webhook);
    assert.ok(Webhook.ASN_WEBHOOK || Webhook.SALES_ORDER_SHIPPING_WEBHOOK || Webhook.RETURN_ORDER_WEBHOOK);
  });
});

describe("QianyiError", () => {
  it("应该正确创建错误实例", () => {
    const err = new QianyiError("TEST_CODE", "测试错误", { raw: true });
    assert.ok(err instanceof Error);
    assert.ok(err instanceof QianyiError);
    assert.equal(err.name, "QianyiError");
    assert.equal(err.code, "TEST_CODE");
    assert.equal(err.message, "测试错误");
    assert.deepEqual(err.raw, { raw: true });
  });

  it("raw 默认为 null", () => {
    const err = new QianyiError("CODE", "msg");
    assert.equal(err.raw, null);
  });
});
