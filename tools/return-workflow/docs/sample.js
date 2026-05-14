const axios = require("axios");
const fs = require("fs");
const path = require("path");

//=== input params start
const appID = process.env.APP_ID; // app_id, required, 应用 ID
// 应用唯一标识，创建应用后获得。有关app_id 的详细介绍。请参考通用参数https://open.feishu.cn/document/ukTMukTMukTM/uYTM5UjL2ETO14iNxkTN/terminology。
const appSecret = process.env.APP_SECRET; // app_secret, required, 应用 secret
// 应用秘钥，创建应用后获得。有关 app_secret 的详细介绍，请参考https://open.feishu.cn/document/ukTMukTMukTM/uYTM5UjL2ETO14iNxkTN/terminology。
const imageUrl = process.env.IMAGE_URL; // string, required, 图片 URL
// 要上传的图片的网络地址
const appToken = process.env.APP_TOKEN; // string, required, 多维表格 token
// 多维表格的唯一标识符
//=== input params end

// 把错误信息和排查建议打印出来，方便排查
function axiosErrorLog(response) {
  const data = response?.data;
  if (data?.error) {
    console.error("Error:", data);
  }
}

// 获取 tenant_access_token
async function getTenantAccessToken(appID, appSecret) {
  const url =
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

  const payload = {
    app_id: appID,
    app_secret: appSecret,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    const result = response.data;
    if (result.code !== 0) {
      console.error("Error:", result);
      throw new Error(`failed to get tenant_access_token: ${result.msg}`);
    }
    return result.tenant_access_token;
  } catch (error) {
    axiosErrorLog(error.response);
    throw new Error(`Error getting tenant_access_token: ${error.message}`);
  }
}

// 下载图片为文件流
async function downloadImage(imageUrl) {
  try {
    console.log("开始下载图片:", imageUrl);
    const response = await axios.get(imageUrl, {
      responseType: "stream",
    });

    const contentType = response.headers["content-type"];
    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error("下载的内容不是图片");
    }

    // 从URL中提取文件名，或使用默认名称
    const urlPath = new URL(imageUrl).pathname;
    const fileName = path.basename(urlPath) || "downloaded_image";
    const fileExtension = contentType.split("/")[1] || "jpg";
    const finalFileName = fileName.includes(".")
      ? fileName
      : `${fileName}.${fileExtension}`;

    console.log("图片下载成功，文件名:", finalFileName);
    return {
      stream: response.data,
      fileName: finalFileName,
      size: parseInt(response.headers["content-length"]) || 0,
    };
  } catch (error) {
    console.error("ERROR: 下载图片失败:", error.message);
    throw new Error(`下载图片失败: ${error.message}`);
  }
}

// 上传图片素材到飞书
async function uploadImageToFeishu(
  tenantAccessToken,
  imageStream,
  fileName,
  fileSize,
  appToken,
) {
  try {
    const formData = new FormData();
    formData.append("file_name", fileName);
    formData.append("parent_type", "bitable_image");
    formData.append("parent_node", appToken);
    formData.append("size", fileSize.toString());
    formData.append("file", imageStream, {
      filename: fileName,
      knownLength: fileSize,
    });

    const url = "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all";
    const headers = {
      Authorization: `Bearer ${tenantAccessToken}`,
      ...formData.getHeaders(),
    };

    console.log("POST:", url);
    console.log("上传参数:", {
      file_name: fileName,
      parent_type: "bitable_image",
      parent_node: appToken,
      size: fileSize,
    });

    const response = await axios.post(url, formData, { headers });
    const result = response.data;

    if (result.code !== 0) {
      console.error("ERROR: 上传图片素材失败", result);
      throw new Error(`上传图片素材失败: ${result.msg}`);
    }

    console.log("图片素材上传成功，file_token:", result.data.file_token);
    return result.data.file_token;
  } catch (error) {
    axiosErrorLog(error.response);
    throw new Error(`上传图片素材失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  try {
    // 获取 tenant_access_token
    const tenantAccessToken = await getTenantAccessToken(appID, appSecret);
    console.log("获取 tenant_access_token 成功");

    // 下载图片
    const { stream, fileName, size } = await downloadImage(imageUrl);

    // 上传图片到飞书
    const fileToken = await uploadImageToFeishu(
      tenantAccessToken,
      stream,
      fileName,
      size,
      appToken,
    );

    console.log("图片上传完成，file_token:", fileToken);
    console.log("接下来可以使用此 file_token 写入多维表格的附件字段");

    return fileToken;
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

// FormData polyfill for Node.js
class FormData {
  constructor() {
    this._data = [];
    this._boundary = "--------------------------" + Date.now().toString(16);
  }

  append(key, value, options = {}) {
    this._data.push({
      key,
      value,
      options,
    });
  }

  getHeaders() {
    return {
      "Content-Type": `multipart/form-data; boundary=${this._boundary}`,
    };
  }

  getBuffer() {
    let buffer = Buffer.alloc(0);

    for (const field of this._data) {
      let fieldBuffer = Buffer.from(`--${this._boundary}\r\n`);
      buffer = Buffer.concat([buffer, fieldBuffer]);

      if (typeof field.value === "string") {
        fieldBuffer = Buffer.from(
          `Content-Disposition: form-data; name="${field.key}"\r\n\r\n${field.value}\r\n`,
        );
      } else if (field.value.pipe) {
        // Stream
        const filename = field.options.filename || "file";
        fieldBuffer = Buffer.from(
          `Content-Disposition: form-data; name="${field.key}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        );
        buffer = Buffer.concat([buffer, fieldBuffer]);

        // 由于我们无法直接获取流的Buffer，这里需要特殊处理
        // 在实际应用中，可能需要先将流保存到临时文件再读取
        throw new Error("当前实现不支持直接上传流，需要先保存为文件");
      } else {
        fieldBuffer = Buffer.from(
          `Content-Disposition: form-data; name="${field.key}"\r\n\r\n${field.value}\r\n`,
        );
      }

      buffer = Buffer.concat([buffer, fieldBuffer]);
    }

    fieldBuffer = Buffer.from(`--${this._boundary}--\r\n`);
    buffer = Buffer.concat([buffer, fieldBuffer]);

    return buffer;
  }
}

main();
