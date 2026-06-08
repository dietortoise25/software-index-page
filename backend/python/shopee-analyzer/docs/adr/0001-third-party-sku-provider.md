# 用第三方 SKU Provider 替换浏览器扩展获取 1688 SKU 价格

## 背景

1688 的 SKU 价格接口(`queryOfferSkuSelectorModel`)需要登录态,后端游客态调不通。早期方案借一个浏览器扩展:SSE 流在以图搜货后用 `threading.Event` 挂起,前端 postMessage 调扩展,扩展用用户浏览器里的 1688 登录 cookie + MD5 签名调 SKU 接口(单线程、3 秒/次防风控),再 POST 回后端唤醒 SSE。该方案脆弱:依赖用户本地登录态、易被风控、链路长且难维护。

## 决策

引入通用 **SKU Provider** 抽象层(输入候选商品 id,输出统一格式 SKU 价格表),后端在以图搜货完成后直接并发调用 provider 获取 SKU 价格表。预留万邦(onebound)与 JustOneAPI 两个实现占位,具体选型与 key 后补。同时**删除**浏览器扩展、SSE 挂起等待机制、`sku-batch`/`sku-result` 端点、`ProxyStatus` 双向通信、`fetch_sku_prices` 的直连/代理逻辑。

## 边界

- 以图搜货保持游客态方案不变,本次只替换 SKU 价格获取这一环。
- SSE 保留,但退化为单向的"后端处理进度 + 错误状态暴露"通道。
- 成本/利润/推荐计算本次冻结:在 [[智能 SKU 匹配]] 能力(后续推荐系统)就绪前,不用 SKU 价格表硬算成本。provider 失败的商品以状态标记呈现,不阻塞整体工作流。

## 权衡

浏览器扩展零 API 成本但脆弱、耦合用户环境;第三方 provider 按量付费但稳定、纯后端化、可插拔。选择后者以换取可维护性与可靠性。
