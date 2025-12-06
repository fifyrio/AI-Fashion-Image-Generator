# 图片元数据处理脚本

本目录包含用于批量添加和验证图片 EXIF 元数据的脚本。

## 脚本说明

### 1. 批量添加元数据 (`batch-add-metadata.ts`)

批量为 `batch-resources` 目录下的所有图片添加 iPhone 13 的 EXIF 元数据。

**添加的元数据包括：**
- 设备制造商: Apple
- 设备型号: iPhone 13
- 色彩空间: RGB
- 颜色描述文件: Display P3
- 焦距: 2.71 毫米
- 光圈数: f/2.2
- 曝光程序: 正常
- 曝光时间: 1/16 秒
- 测光模式: 矩阵测光
- GPS 坐标: 32°18'49.332"北, 118°48'55.272"东
- Alpha通道: 否
- 红眼: 否

**使用方法：**

```bash
# 1. 将要处理的图片放入 batch-resources 目录
cp your-image.jpg scripts/batch-resources/

# 2. 运行批量处理命令
npm run batch-metadata

# 或者直接运行
npx tsx scripts/batch-add-metadata.ts
```

**输出：**
- 处理后的图片会保存在同一目录下
- 文件名格式: `IMG_7XXX.jpg`（XXX 是随机三位数字）
- 原图片不会被修改

### 2. 验证元数据 (`verify-metadata.ts`)

验证图片的 EXIF 元数据是否正确添加。

**使用方法：**

```bash
# 验证单个图片
npm run verify-metadata scripts/batch-resources/IMG_7123.jpg

# 验证多个图片
npm run verify-metadata scripts/batch-resources/IMG_7123.jpg scripts/batch-resources/IMG_7456.jpg

# 或者直接运行
npx tsx scripts/verify-metadata.ts <image-path>
```

**输出示例：**

```
验证文件: scripts/batch-resources/IMG_7086.jpg
============================================================

图片尺寸: 1536x2688
颜色空间: srgb
ICC 配置文件: N/A

--- 设备信息 ---
制造商: Apple
型号: iPhone 13
软件: iOS 17.0

--- 拍摄参数 ---
曝光时间: 1/16 秒
光圈: f/2.2
焦距: 2.71 mm
测光模式: 矩阵测光
镜头型号: iPhone 13 front camera 2.71mm f/2.2

--- GPS 信息 ---
纬度: 32°18'49.332"N
经度: 118°48'55.272"E
```

### 3. 单图片添加元数据 (`add-metadata.ts`)

为单个图片添加元数据（原有脚本）。

**使用方法：**

```bash
npx tsx scripts/add-metadata.ts <image-path>
```

## 支持的图片格式

- `.jpg` / `.jpeg`
- `.png`
- `.webp`

## 注意事项

1. **自动转换**: 所有图片都会被转换为 JPEG 格式（质量 95%）
2. **保留尺寸**: 图片的原始尺寸会被保留
3. **随机文件名**: 输出文件名采用 `IMG_7XXX.jpg` 格式，避免文件名冲突
4. **批量处理**: `batch-add-metadata.ts` 会处理目录中的所有图片，单个失败不影响其他图片

## 工作流程示例

```bash
# 1. 准备图片
mkdir -p scripts/batch-resources
cp ~/Pictures/*.jpg scripts/batch-resources/

# 2. 批量处理
npm run batch-metadata

# 3. 验证结果
npm run verify-metadata scripts/batch-resources/IMG_7*.jpg

# 4. 使用处理后的图片
# 处理后的图片包含完整的 iPhone 13 EXIF 元数据
```

## 技术细节

- 使用 `sharp` 进行图片处理和转换
- 使用 `piexifjs` 库写入和读取 EXIF 元数据
- GPS 坐标使用标准 EXIF 格式（度/分/秒）
- 所有时间戳使用当前系统时间

## 故障排除

**问题：找不到 `lib/metadata` 模块**
- 确保 `lib/metadata.ts` 文件存在
- 运行 `npm install` 确保依赖已安装

**问题：图片处理失败**
- 检查图片文件是否损坏
- 确认图片格式是否支持
- 查看错误信息了解具体原因

**问题：EXIF 数据未写入**
- 确保使用的是 JPEG 格式（PNG 等格式可能不支持完整 EXIF）
- 使用 `verify-metadata.ts` 检查输出文件
