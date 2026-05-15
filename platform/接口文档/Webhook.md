## 1.1. 入库反馈推送接口

### 1.1.1. 反馈地址配置

<div class="image-wrapper">![img.png](../../assets/images/img.png)</div>
<div class="image-wrapper">![img.png](../../assets/images/img2.png)</div>
<div class="image-wrapper">![img.png](../../assets/images/img3.png)</div>

### 1.1.2. SERVICE_TYPE

PUSH_ASN_ORDER

### 1.1.3. 推送消息内容

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| asnNumber | Y | String | “A230109129883” | 入库单号 |
| trackNumber | N | String |  | 跟踪单号 |
| skuList | Y | List<Sku> |  | Sku收货数据 |
| status | Y | String |  | 入库单状态 FINISHED 已完成 CLOSED 已关闭 |
| finishedTime | Y | Date |  | 入库单完成时间**条件必传**，仅当status=FINISHED时传值 |
| customNumber | N | String |  | 参考号 |

Sku

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| quantity | Y | Number | 100 | 收货数量 |
| sku | Y | String | Sku | 商品sku |
| batchNo | N | String |  | 批次号，仅对千易wms生效 |
| mfgDate | N | String | 2025-10-01 | 生产日期，仅对千易wms生效 |
| expDate | N | String | 2025-10-01 | 失效日期，仅对千易wms生效 |
| originCountry | N | String | CN | 生产地国家，仅对千易wms生效 |

**推送示例**（默认form-data格式）：

JSON格式：
{"appId":"TEST","bizParam":"{\"asnNumber\":\"A250619145545\",\"customNumber\":\"2025061900007\",\"status\":\"RECEIVING\",\"trackNumber\":\"CGDD0000787\",\"skuList\":[{\"sku\":\"LIP005\",\"quantity\":1},{\"quantity\":1,\"sku\":\"LIP005\"}]}","serviceType":"PUSH_ASN_ORDER","timestamp":"1754016113505","sign":"77fd745547a99d46cf5d2f17697a7c6e"}

FORM-DATA格式：
{appId=1111-3, bizParam={"asnNumber":"A250731147584","customNumber":"1000832922","finishedTime":1753942939000,"skuList":[{"damageNum":0,"goodNum":9,"quantity":9,"sku":"PPB24700027"}],"status":"FINISHED","trackNumber":"4700041511"}, serviceType=PUSH_ASN_ORDER, timestamp=1753942939728, sign=8f40f3de6778c990bc7b762314b182ac}

## 1.2. 订单物流信息推送接口

### 1.2.1. SERVICE_TYPE

PUSH_SALES_ORDER_SHIPPING_INFO

### 1.2.2. 推送消息内容

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| orderNumber | Y | String | “S200222115613” | 系统订单号 |
| onlineOrderNumber | Y | String |  | 订单创建时设置的线上单号 |
| trackingNumber | Y | String |  | 运单号 |
| carrier | Y | String |  | 承运商 |
| shippingTime | Y | Datetime |  | 发货时间，"yyyy-MM-dd hh:mm:ss SSS" |
| status | Y | String |  | [订单状态](../../commons/enums.html#订单状态说明) |

**推送示例**（默认form-data格式）：

JSON格式：
{"appId":"TEST","bizParam":"{\"carrier\":\"SHIPDOC\",\"onlineOrderNumber\":\"2507311347270601016525823\",\"orderNumber\":\"S250731147586\",\"shippingTime\":1754014435000,\"status\":\"WAIT_SHIP\",\"trackingNumber\":\"223243444\"}","serviceType":"PUSH_SALES_ORDER_SHIPPING_INFO","timestamp":"1754272685482","sign":"7cbc7305af85fb2eed308866c4fbaf89"}

FORM-DATA格式：
{appId=1111-3, bizParam={"carrier":"SHIPDOC","onlineOrderNumber":"2507311347270601016525823","orderNumber":S250731147586,"shippingTime":1754014435000,"status":"WAIT_SHIP","trackingNumber":"223243444"}, serviceType=PUSH_SALES_ORDER_SHIPPING_INFO, timestamp=1754272685482, sign=7cbc7305af85fb2eed308866c4fbaf89}

## 1.3. 退货单完成信息推送接口

### 1.3.1. SERVICE_TYPE

PUSH_RETURN_ORDER_INFO

### 1.3.2. 推送消息内容

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| returnNumber | Y | String | “B200308115691” | 退货单号 |
| orderNumber | Y | String | “S200222115613” | 销售订单号 |
| onlineOrderNumber | Y | String | “DA200221115559” | 关联线上单号 |
| status | Y | String | “FINISH” | [状态](../../commons/enums.html#退货订单状态) |
| returnSkuList | Y | List<ReturnSku> |  | 详见退货SKU |

ReturnSku(退货SKU)

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| sku | Y | String | “abc” | 商品SKU |
| orderSkuId | Y | Number |  | 销售订单商品ID |
| quantity | Y | Number | 1 | 实际退货数量 |

**推送示例**（默认form-data格式）：

JSON格式：
{"serviceType":"PUSH_RETURN_ORDER_INFO","appId":"15167732016","sign":"b55826f1b417bd398aacf61aaa8abe23","bizParam":"{\"orderNumber\":\"THTZD000859\",\"returnSkuList\":[{\"orderSkuId\":45,\"quantity\":1,\"sku\":\"JCDF692024YH002\"}],\"onlineOrderNumber\":\"THTZD000859\",\"returnNumber\":\"B250801537077\",\"status\":\"WAIT_STORAGE\"}","timestamp":"1754033260116"}

FORM-DATA格式：
{serviceType=PUSH_RETURN_ORDER_INFO,appId=15167732016,sign=b55826f1b417bd398aacf61aaa8abe23,bizParam={\"orderNumber\":\"THTZD000859\",\"returnSkuList\":[{\"orderSkuId\":45,\"quantity\":1,\"sku\":\"JCDF692024YH002\"}],\"onlineOrderNumber\":\"THTZD000859\",\"returnNumber\":\"B250801537077\",\"status\":\"WAIT_STORAGE\"},timestamp=1754033260116}

## 1.4. 物流跟踪状态变更推送接口

### 1.4.1. SERVICE_TYPE

PUSH_TRACKING_PACKAGE

### 1.4.2. 推送消息内容

Base

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| orderNumber | Y | String | “S230109129883” | 系统单号 |
| onlineOrderId | Y | String | xsasx | 线上订单号 |
| trackingNumber | Y | String | 运单号 | 11111 |
| carrier | Y | String | 承运商 | LEX TH |
| status | Y | String | CREATED | [状态枚举](../../commons/enums.html#物流跟踪状态枚举) |

**推送示例**（默认form-data格式）：

JSON格式：
{"appId":"1751530655877-10658", "bizParam":"{\"carrier\":\"J&T Express\",\"onlineOrderId\":\"579877366324626911\",\"orderNumber\":\"S2508053858595\",\"status\":\"CREATED\",\"trackingNumber\":\"762388742732\"}", "serviceType":"PUSH_TRACKING_PACKAGE", "timestamp":1754373394777, "sign":"c0fe6c3ab1a92831dffa5796fbf08a27"}

FORM-DATA格式：
{appId=1751530655877-10658, bizParam={"carrier":"J&T Express","onlineOrderId":"579877366324626911","orderNumber":"S2508053858595","status":"CREATED","trackingNumber":"762388742732"}, serviceType=PUSH_TRACKING_PACKAGE, timestamp=1754373394777, sign=c0fe6c3ab1a92831dffa5796fbf08a27}

## 1.5. 订阅订单状态(开发中)

### 1.5.1. SERVICE_TYPE

SUBSCRIBE_ORDER

### 1.5.2. 请求参数

| 字段名 | 字段描述 | 类型 | 必填 | 备注 |
| --- | --- | --- | --- | --- |
| orderType | 订单类型 | String | 是 | 入库单：ASN |
| orderList | 订单列表 | Array | 是 |  |
| └ orderNumber | 单号 | String | 是 |

### 1.5.3. 返回参数

| 参数 | 是否必须 | 类型 | 示例 | 备注 |
| --- | --- | --- | --- | --- |
| orderList | Y | Array |  | 失败列表 |
| └ orderNumber | Y | String |  | 入库单号 |
| └ errorMessage | Y | String |  | 失败原因 |
