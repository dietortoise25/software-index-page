## 1.1. API 接入指南

### 1.1.1. 📋 快速开始

开始使用千易 API 之前，请按照以下步骤完成接入：

1. **获取认证信息** - 登录千易ERP-设置-三方应用对接 获取 `appId` 和 `appSecret`
2. **选择环境** - 根据需要选择测试或生产环境
3. **构建请求** - 按照规范构建请求参数
4. **生成签名** - 使用 MD5 算法生成签名
5. **发送请求** - 发起 POST 请求到指定接口
6. **处理响应** - 解析返回的 JSON 数据

---

### 1.1.2. 🌍 环境配置

| 环境 | 地址 | 用途 |
| --- | --- | --- |
| 测试环境 | gerp-test1.800best.com | 开发和测试 |
| 国内生产环境 | www.qianyierp.com | 国内正式服务 |
| 海外生产环境 | asia.qianyierp.com | 海外正式服务 |

**建议**: 先在测试环境完成调试，确认无误后再切换到生产环境。

---

### 1.1.3. 🔧 基础配置

#### 请求方式

- **HTTP Method**: POST
- **Content-Type**: multipart/form-data
- **编码方式**: UTF-8
- **接口版本**: v1

#### URL 格式

```
https://{域名}/api/v1/{接口路径}
```

**示例**: `https://www.qianyierp.com/api/v1/asn`

---

### 1.1.4. 📝 请求参数规范

#### 必需的公共参数

| 参数 | 类型 | 必须 | 示例 | 说明 |
| --- | --- | --- | --- | --- |
| appId | String | ✅ | "openApi_TEST" | 千易分配的应用ID |
| serviceType | String | ✅ | "QUERY_SALES_ORDER_LIST" | 接口服务类型 |
| bizParam | String | ✅ | "{...}" | 各个请求参数(JSON字符串格式) |
| timestamp | Number | ✅ | 1662448537275 | 当前时间戳(毫秒) |
| sign | String | ✅ | "b3dfeed438e36f1f..." | 签名字符串 |

#### 🔐 签名生成步骤

签名是确保 API 请求安全的重要机制，请严格按照以下步骤生成：

**步骤 1: 参数排序**
将除 `sign` 外的所有参数按参数名的 ASCII 码升序排列

**步骤 2: 拼接字符串**
按照 `参数名=参数值` 的格式拼接所有参数，最后拼接 `appSecret`

**格式**: `appId=值bizParam=值serviceType=值timestamp=值{appSecret}`

**步骤 3: MD5 加密**
对拼接后的字符串进行 MD5 加密，得到 32 位小写签名

#### 签名算法示例

**Java 实现**:

```
<span class="hljs-keyword">package</span> com.example.qianyi.sign;
<span class="hljs-keyword">import</span> org.springframework.util.DigestUtils;
<span class="hljs-keyword">import</span> java.nio.charset.StandardCharsets;

<span class="hljs-keyword">public</span> <span class="hljs-class"><span class="hljs-keyword">class</span> <span class="hljs-title">SignUtils</span> </span>{

    <span class="hljs-comment">/**
     * 生成API签名
     */</span>
    <span class="hljs-function"><span class="hljs-keyword">public</span> <span class="hljs-keyword">static</span> String <span class="hljs-title">generateSign</span><span class="hljs-params">(String appId, String bizParam, 
                                    String serviceType, Long timestamp, String appSecret)</span> </span>{
        String signStr = buildSignString(appId, bizParam, serviceType, timestamp, appSecret);
        <span class="hljs-keyword">return</span> DigestUtils.md5DigestAsHex(signStr.getBytes(StandardCharsets.UTF_8));
    }

    <span class="hljs-comment">/**
     * 构建签名字符串
     */</span>
    <span class="hljs-function"><span class="hljs-keyword">private</span> <span class="hljs-keyword">static</span> String <span class="hljs-title">buildSignString</span><span class="hljs-params">(String appId, String bizParam, 
                                        String serviceType, Long timestamp, String appSecret)</span> </span>{
        <span class="hljs-keyword">return</span> <span class="hljs-string">"appId="</span> + appId +
               <span class="hljs-string">"bizParam="</span> + bizParam +
               <span class="hljs-string">"serviceType="</span> + serviceType + 
               <span class="hljs-string">"timestamp="</span> + timestamp +
               appSecret;
    }
}
```

**Python 实现**:

```
<span class="hljs-keyword">import</span> hashlib

<span class="hljs-function"><span class="hljs-keyword">def</span> <span class="hljs-title">generate_sign</span><span class="hljs-params">(app_id, biz_param, service_type, timestamp, app_secret)</span>:</span>
    <span class="hljs-string">"""生成API签名"""</span>
    sign_str = f<span class="hljs-string">"appId={app_id}bizParam={biz_param}serviceType={service_type}timestamp={timestamp}{app_secret}"</span>
    <span class="hljs-keyword">return</span> hashlib.md5(sign_str.encode(<span class="hljs-string">'utf-8'</span>)).hexdigest()
```

#### 🔍 签名示例详解

**请求参数**:

```
appId: openApi_TEST
serviceType: CREATE_ASN_ORDER
bizParam: {"asnSkuVOList":[{"expectQuantity":"100","sku":"SKU1230"}],"warehouseName":"测试仓库"}
timestamp: 1662448537275
appSecret: openApi_TOKEN
```

**拼接字符串**:

```
appId=openApi_TESTbizParam={"asnSkuVOList":[{"expectQuantity":"100","sku":"SKU1230"}],"warehouseName":"测试仓库"}serviceType=CREATE_ASN_ORDERtimestamp=1662448537275openApi_TOKEN
```

**生成签名**:

```
sign: b3dfeed438e36f1f89534ce415cf4113
```

---

### 1.1.5. 📤 完整请求示例

#### cURL 示例

```
curl -X POST <span class="hljs-string">"https://gerp-test1.800best.com/api/v1/asn"</span> \
  -F <span class="hljs-string">"appId=openApi_TEST"</span> \
  -F <span class="hljs-string">"serviceType=CREATE_ASN_ORDER"</span> \
  -F <span class="hljs-string">"bizParam={\"warehouseName\":\"测试仓库\"}"</span> \
  -F <span class="hljs-string">"timestamp=1662448537275"</span> \
  -F <span class="hljs-string">"sign=b3dfeed438e36f1f89534ce415cf4113"</span>
```

#### Postman 配置

1. **Method**: POST
2. **URL**: [https://gerp-test1.800best.com/api/v1/asn](https://gerp-test1.800best.com/api/v1/asn)
3. **Body**: form-data
4. **添加参数**: 按照上表添加所有必需参数

<div class="image-wrapper">![Postman签名示例](../assets/images/1706168151097.png)</div>

---

### 1.1.6. 📥 响应格式

#### 标准响应结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| errorCode | String | 错误码 (0表示成功) |
| errorMsg | String | 错误信息 |
| state | String | 请求状态 (success/failure) |
| bizContent | String | 业务数据 (JSON格式字符串) |

#### 成功响应示例

```
{
  <span class="hljs-string">"errorCode"</span>: <span class="hljs-string">"0"</span>,
  <span class="hljs-string">"errorMsg"</span>: <span class="hljs-string">""</span>,
  <span class="hljs-string">"state"</span>: <span class="hljs-string">"success"</span>,
  <span class="hljs-string">"bizContent"</span>: <span class="hljs-string">"{\"orderId\":\"12345\",\"status\":\"created\"}"</span>
}
```

#### 错误响应示例

```
{
  <span class="hljs-string">"errorCode"</span>: <span class="hljs-string">"AUTH_001"</span>,
  <span class="hljs-string">"errorMsg"</span>: <span class="hljs-string">"签名验证失败"</span>,
  <span class="hljs-string">"state"</span>: <span class="hljs-string">"failure"</span>,
  <span class="hljs-string">"bizContent"</span>: <span class="hljs-string">""</span>
}
```

---

### 1.1.7. ⚠️ 常见问题

#### 签名错误

- **检查点**: 参数排序是否正确
- **检查点**: 字符编码是否为 UTF-8
- **检查点**: appSecret 是否正确拼接在最后

#### 时间戳错误

- **建议**: 使用当前时间戳，误差不超过 5 分钟
- **格式**: 13 位毫秒时间戳

#### 参数格式错误

- **bizParam**: 必须是有效的 JSON 字符串
- **Content-Type**: 必须使用 multipart/form-data

---

### 1.1.8. 🔗 相关链接

- [错误码说明](errors.html)
- [接口限制](limit.html)
- [枚举值定义](enums.html)
