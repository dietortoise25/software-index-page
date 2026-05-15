import { describe, it } from "node:test";
import assert from "node:assert";
import * as Constants from "../src/sdk/constants.js";

describe("Constants", () => {
  it("ENVIRONMENTS 包含三个环境", () => {
    assert.ok(Constants.ENVIRONMENTS);
    assert.equal(Constants.ENVIRONMENTS.production_cn, "www.qianyierp.com");
    assert.equal(Constants.ENVIRONMENTS.production_asia, "asia.qianyierp.com");
    assert.equal(Constants.ENVIRONMENTS.test, "gerp-test1.800best.com");
  });

  it("STATE 包含 SUCCESS 和 FAILURE", () => {
    assert.equal(Constants.STATE.SUCCESS, "success");
    assert.equal(Constants.STATE.FAILURE, "failure");
  });

  it("PLATFORM 包含常见电商平台", () => {
    const platforms = Constants.PLATFORM;
    assert.ok(platforms.EBAY);
    assert.ok(platforms.AMAZON);
    assert.ok(platforms.SHOPEE);
    assert.ok(platforms.LAZADA);
    assert.ok(platforms.TIKTOK);
    assert.ok(platforms.TEMU);
    assert.ok(platforms.SHEIN);
    assert.ok(platforms.SHOPIFY);
    assert.ok(platforms.WALMART);
  });

  it("ORDER_STATUS 包含完整订单生命周期", () => {
    const s = Constants.ORDER_STATUS;
    assert.equal(s.WAIT_PAYMENT, "WAIT_PAYMENT");
    assert.equal(s.WAIT_AUDIT, "WAIT_AUDIT");
    assert.equal(s.WAIT_SHIP, "WAIT_SHIP");
    assert.equal(s.SHIPPING, "SHIPPING");
    assert.equal(s.SHIPPED, "SHIPPED");
    assert.equal(s.CLOSED, "CLOSED");
  });

  it("RETURN_ORDER_STATUS 包含退货流程状态", () => {
    const s = Constants.RETURN_ORDER_STATUS;
    assert.equal(s.NEW, "NEW");
    assert.equal(s.FINISH, "FINISH");
    assert.equal(s.CLOSE, "CLOSE");
  });

  it("ASN_STATUS / ODO_STATUS / PURCHASE_STATUS 都有定义", () => {
    assert.ok(Object.keys(Constants.ASN_STATUS).length > 0);
    assert.ok(Object.keys(Constants.ODO_STATUS).length > 0);
    assert.ok(Object.keys(Constants.PURCHASE_STATUS).length > 0);
  });

  it("CURRENCY 包含东南亚主要货币", () => {
    const c = Constants.CURRENCY;
    assert.equal(c.USD, "USD");
    assert.equal(c.CNY, "CNY");
    assert.equal(c.PHP, "PHP");
    assert.equal(c.THB, "THB");
    assert.equal(c.VND, "VND");
    assert.equal(c.IDR, "IDR");
    assert.equal(c.MYR, "MYR");
    assert.equal(c.SGD, "SGD");
  });

  it("TRACKING_STATUS 物流追踪状态完整", () => {
    const s = Constants.TRACKING_STATUS;
    assert.equal(s.CREATED, "CREATED");
    assert.equal(s.DELIVERED, "DELIVERED");
    assert.equal(s.NOT_FOUND, "NOT_FOUND");
  });

  it("所有状态枚举值都为大写字符串", () => {
    const enumGroups = [
      Constants.ORDER_STATUS,
      Constants.RETURN_ORDER_STATUS,
      Constants.ASN_STATUS,
      Constants.ODO_STATUS,
      Constants.PURCHASE_STATUS,
      Constants.TRACKING_STATUS,
      Constants.FIRST_LEG_STATUS,
    ];
    for (const group of enumGroups) {
      for (const val of Object.values(group)) {
        assert.equal(val, val.toUpperCase(), `${val} 应为全大写`);
      }
    }
  });

  it("SHOP_STATUS 只有 LOCK 和 UNLOCK", () => {
    const s = Constants.SHOP_STATUS;
    assert.deepEqual(Object.values(s).sort(), ["LOCK", "UNLOCK"]);
  });

  it("WAREHOUSE_KIND 包含三种类型", () => {
    const w = Constants.WAREHOUSE_KIND;
    assert.ok(w.SHIP);
    assert.ok(w.TRANSFER);
    assert.ok(w.COMPLEX);
  });
});
