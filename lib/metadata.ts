import piexif from 'piexifjs';

/**
 * 将度数转换为 EXIF GPS 格式 [度, 分, 秒]
 */
function decimalToGPS(decimal: number): [[number, number], [number, number], [number, number]] {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 10000);

  return [
    [degrees, 1],
    [minutes, 1],
    [seconds, 10000]
  ];
}

/**
 * 将分数转换为 EXIF 格式的有理数
 */
function toRational(value: number, denominator: number = 10000): [number, number] {
  return [Math.floor(value * denominator), denominator];
}

/**
 * 为图片添加 iPhone 13 的 EXIF 元数据
 *
 * @param base64Image - Base64 编码的图片（可以带或不带 data:image 前缀）
 * @param width - 图片宽度
 * @param height - 图片高度
 * @returns 带有 EXIF 元数据的 Base64 编码图片
 */
export async function addIPhone13Metadata(
  base64Image: string,
  width: number,
  height: number
): Promise<string> {
  try {
    // 移除 data:image 前缀（如果存在）
    let imageData = base64Image;
    if (base64Image.startsWith('data:image')) {
      imageData = base64Image.split(',')[1];
    }

    // GPS 坐标: 32°18'49.332"北, 118°48'55.272"东
    const latitude = 32 + 18/60 + 49.332/3600;  // 32.313703
    const longitude = 118 + 48/60 + 55.272/3600; // 118.815353

    // 创建 EXIF 数据
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exifObj: Record<string, any> = {
      '0th': {
        [piexif.ImageIFD.Make]: 'Apple',
        [piexif.ImageIFD.Model]: 'iPhone 13',
        [piexif.ImageIFD.XResolution]: [72, 1],
        [piexif.ImageIFD.YResolution]: [72, 1],
        [piexif.ImageIFD.ResolutionUnit]: 2, // inches
        [piexif.ImageIFD.Software]: 'iOS 17.0',
        [piexif.ImageIFD.DateTime]: new Date().toISOString().slice(0, 19).replace('T', ' '),
        [piexif.ImageIFD.YCbCrPositioning]: 1,
        [piexif.ImageIFD.Orientation]: 1,
      },
      'Exif': {
        [piexif.ExifIFD.DateTimeOriginal]: new Date().toISOString().slice(0, 19).replace('T', ' '),
        [piexif.ExifIFD.DateTimeDigitized]: new Date().toISOString().slice(0, 19).replace('T', ' '),
        [piexif.ExifIFD.ExposureTime]: [1, 16], // 1/16 秒
        [piexif.ExifIFD.FNumber]: toRational(2.2, 10), // f/2.2
        [piexif.ExifIFD.ExposureProgram]: 2, // Normal program (正常程序)
        [piexif.ExifIFD.ISOSpeedRatings]: 64,
        [piexif.ExifIFD.ExifVersion]: '0232',
        [piexif.ExifIFD.ComponentsConfiguration]: '\x01\x02\x03\x00',
        [piexif.ExifIFD.ShutterSpeedValue]: toRational(4.0), // APEX value for 1/16
        [piexif.ExifIFD.ApertureValue]: toRational(2.27), // APEX value for f/2.2
        [piexif.ExifIFD.BrightnessValue]: toRational(5.0),
        [piexif.ExifIFD.ExposureBiasValue]: [0, 1],
        [piexif.ExifIFD.MeteringMode]: 5, // Pattern (矩阵测光)
        [piexif.ExifIFD.Flash]: 16, // Flash did not fire
        [piexif.ExifIFD.FocalLength]: toRational(2.71, 100), // 2.71mm
        [piexif.ExifIFD.SubjectArea]: [width / 2, height / 2, width / 4, height / 4],
        [piexif.ExifIFD.SubSecTimeOriginal]: '000',
        [piexif.ExifIFD.SubSecTimeDigitized]: '000',
        [piexif.ExifIFD.FlashpixVersion]: '0100',
        [piexif.ExifIFD.ColorSpace]: 65535, // Uncalibrated (会使用 ICC Profile)
        [piexif.ExifIFD.PixelXDimension]: width,
        [piexif.ExifIFD.PixelYDimension]: height,
        [piexif.ExifIFD.SensingMethod]: 2, // One-chip color area sensor
        [piexif.ExifIFD.SceneType]: '\x01',
        [piexif.ExifIFD.ExposureMode]: 0, // Auto exposure
        [piexif.ExifIFD.WhiteBalance]: 0, // Auto white balance
        [piexif.ExifIFD.FocalLengthIn35mmFilm]: 13,
        [piexif.ExifIFD.SceneCaptureType]: 0, // Standard
        [piexif.ExifIFD.LensSpecification]: [[2.71, 100], [2.71, 100], [22, 10], [22, 10]],
        [piexif.ExifIFD.LensMake]: 'Apple',
        [piexif.ExifIFD.LensModel]: 'iPhone 13 front camera 2.71mm f/2.2',
      },
      'GPS': {
        [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
        [piexif.GPSIFD.GPSLatitudeRef]: 'N',
        [piexif.GPSIFD.GPSLatitude]: decimalToGPS(latitude),
        [piexif.GPSIFD.GPSLongitudeRef]: 'E',
        [piexif.GPSIFD.GPSLongitude]: decimalToGPS(longitude),
        [piexif.GPSIFD.GPSAltitudeRef]: 0,
        [piexif.GPSIFD.GPSAltitude]: [50, 1], // 50 meters
        [piexif.GPSIFD.GPSTimeStamp]: [
          [new Date().getUTCHours(), 1],
          [new Date().getUTCMinutes(), 1],
          [new Date().getUTCSeconds(), 1]
        ],
        [piexif.GPSIFD.GPSSpeedRef]: 'K',
        [piexif.GPSIFD.GPSSpeed]: [0, 1],
        [piexif.GPSIFD.GPSImgDirectionRef]: 'T',
        [piexif.GPSIFD.GPSImgDirection]: [0, 1],
        [piexif.GPSIFD.GPSDestBearingRef]: 'T',
        [piexif.GPSIFD.GPSDestBearing]: [0, 1],
        [piexif.GPSIFD.GPSDateStamp]: new Date().toISOString().slice(0, 10).replace(/-/g, ':'),
        [piexif.GPSIFD.GPSHPositioningError]: toRational(5.0), // 5 meters
      },
      '1st': {},
      'thumbnail': null as unknown as undefined,
    };

    // 生成 EXIF 字节
    const exifBytes = piexif.dump(exifObj);

    // 插入 EXIF 数据到 JPEG
    const newImage = piexif.insert(exifBytes, 'data:image/jpeg;base64,' + imageData);

    return newImage;
  } catch (error) {
    console.error('Error adding EXIF metadata:', error);
    throw error;
  }
}
