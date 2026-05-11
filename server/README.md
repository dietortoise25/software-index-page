# 网站后端服务

## 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| `relay_server.py` | 8765 | 需求提交中继，接收前端表单 → 飞书消息 |

## 部署

### 首次部署

```bash
# 1. 上传文件
scp server/relay_server.py server/requirements.txt ubuntu@42.193.170.109:/var/www/software-index/server/

# 2. 安装依赖
ssh ubuntu@42.193.170.109 "pip3 install -r /var/www/software-index/server/requirements.txt"

# 3. 安装 systemd 服务
scp server/relay.service ubuntu@42.193.170.109:/tmp/
ssh ubuntu@42.193.170.109 "sudo mv /tmp/relay.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now relay"

# 4. 验证
ssh ubuntu@42.193.170.109 "sudo systemctl status relay && curl -s -X POST http://127.0.0.1:8765/api/requirement -d 'type=new-tool&title=test&department=ops&priority=high&description=test&contact=test'"
```

### 更新代码

```bash
scp server/relay_server.py ubuntu@42.193.170.109:/var/www/software-index/server/
ssh ubuntu@42.193.170.109 "sudo systemctl restart relay"
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `FEISHU_APP_SECRET` | 飞书应用 Secret | 代码内置（测试用） |
