import fs from 'fs/promises';
import sharp from 'sharp';
import piexif from 'piexifjs';

async function verifyMetadata(filePath: string) {
  console.log(`\n验证文件: ${filePath}`);
  console.log('='.repeat(60));

  try {
    const buffer = await fs.readFile(filePath);

    // 使用 sharp 读取基本信息
    const metadata = await sharp(buffer).metadata();
    console.log(`\n图片尺寸: ${metadata.width}x${metadata.height}`);
    console.log(`颜色空间: ${metadata.space || 'N/A'}`);
    console.log(`ICC 配置文件: ${metadata.iccProfileName || 'N/A'}`);

    // 使用 piexifjs 读取 EXIF
    const base64 = buffer.toString('base64');
    const dataUrl = 'data:image/jpeg;base64,' + base64;

    try {
      const exifObj = piexif.load(dataUrl);

      console.log('\n--- 设备信息 ---');
      if (exifObj['0th']) {
        console.log(`制造商: ${exifObj['0th'][piexif.ImageIFD.Make] || 'N/A'}`);
        console.log(`型号: ${exifObj['0th'][piexif.ImageIFD.Model] || 'N/A'}`);
        console.log(`软件: ${exifObj['0th'][piexif.ImageIFD.Software] || 'N/A'}`);
      }

      console.log('\n--- 拍摄参数 ---');
      if (exifObj['Exif']) {
        const exposureTime = exifObj['Exif'][piexif.ExifIFD.ExposureTime];
        if (exposureTime) {
          console.log(`曝光时间: ${exposureTime[0]}/${exposureTime[1]} 秒`);
        }

        const fNumber = exifObj['Exif'][piexif.ExifIFD.FNumber];
        if (fNumber) {
          console.log(`光圈: f/${(fNumber[0] / fNumber[1]).toFixed(1)}`);
        }

        const focalLength = exifObj['Exif'][piexif.ExifIFD.FocalLength];
        if (focalLength) {
          console.log(`焦距: ${(focalLength[0] / focalLength[1]).toFixed(2)} mm`);
        }

        const meteringMode = exifObj['Exif'][piexif.ExifIFD.MeteringMode];
        const meteringModes: Record<number, string> = {
          1: '平均测光',
          2: '中央重点测光',
          3: '点测光',
          4: '多点测光',
          5: '矩阵测光',
          6: '部分测光'
        };
        if (meteringMode) {
          console.log(`测光模式: ${meteringModes[meteringMode] || meteringMode}`);
        }

        const lensModel = exifObj['Exif'][piexif.ExifIFD.LensModel];
        if (lensModel) {
          console.log(`镜头型号: ${lensModel}`);
        }
      }

      console.log('\n--- GPS 信息 ---');
      if (exifObj['GPS']) {
        const latRef = exifObj['GPS'][piexif.GPSIFD.GPSLatitudeRef];
        const lat = exifObj['GPS'][piexif.GPSIFD.GPSLatitude];
        const lonRef = exifObj['GPS'][piexif.GPSIFD.GPSLongitudeRef];
        const lon = exifObj['GPS'][piexif.GPSIFD.GPSLongitude];

        if (lat && lon) {
          const latDeg = lat[0][0] / lat[0][1];
          const latMin = lat[1][0] / lat[1][1];
          const latSec = lat[2][0] / lat[2][1];

          const lonDeg = lon[0][0] / lon[0][1];
          const lonMin = lon[1][0] / lon[1][1];
          const lonSec = lon[2][0] / lon[2][1];

          console.log(`纬度: ${latDeg}°${latMin}'${latSec.toFixed(3)}"${latRef}`);
          console.log(`经度: ${lonDeg}°${lonMin}'${lonSec.toFixed(3)}"${lonRef}`);
        }
      }

    } catch (exifError) {
      console.log('\n⚠️  无法读取 EXIF 数据:', exifError);
    }

  } catch (error) {
    console.error('错误:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: npx tsx scripts/verify-metadata.ts <image-path>');
    console.log('\n示例:');
    console.log('  npx tsx scripts/verify-metadata.ts scripts/batch-resources/IMG_7123.jpg');
    process.exit(1);
  }

  for (const filePath of args) {
    await verifyMetadata(filePath);
  }
}

main();
