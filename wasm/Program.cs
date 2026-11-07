using System.IO.Compression;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Sdcb.SimdCodecs.Png;

// Nothing runs at start-up: the worker calls the exports below.
return;

[SupportedOSPlatform("browser")]
static partial class Quantizer
{
    /// <summary>
    /// Decodes a PNG and writes it again as a palette PNG (at most <paramref name="maxColors"/> colours, alpha included).
    /// <paramref name="compressionLevel"/> is a <see cref="CompressionLevel"/> value (Optimal 0, Fastest 1, SmallestSize 3).
    /// With <paramref name="keepMetadata"/> the colour-space chunks (iCCP, sRGB, gAMA, cHRM, cICP) are kept; without,
    /// they are dropped, like pngquant --strip. Throws on a file that is not a valid PNG.
    /// </summary>
    [JSExport]
    internal static byte[] Quantize(
        byte[] png, int minQuality, int maxQuality, int maxColors, bool dither, int compressionLevel, bool keepMetadata)
    {
        var image = PngReader.Decode(png);
        var rgba = new byte[checked(image.Width * image.Height * 4)];
        image.ExpandToRgba8(rgba);
        var options = BaseOptions(minQuality, maxQuality, maxColors, dither, compressionLevel);
        if (keepMetadata)
        {
            options = options with
            {
                IccProfile = image.IccProfile,
                SrgbRenderingIntent = image.SrgbRenderingIntent,
                Gamma = image.Gamma,
                Chromaticity = image.Chromaticity,
                Cicp = image.Cicp,
            };
            if (image.IccProfileName is { } name) options = options with { IccProfileName = name };
        }
        return PngWriter.Encode(rgba, image.Width, image.Height, options);
    }

    /// <summary>
    /// Writes 8-bit RGBA pixels (non-premultiplied, sRGB: what a browser canvas's getImageData returns) as a palette PNG,
    /// tagged sRGB (perceptual). For images the browser decoded itself (JPEG, WebP, AVIF, ...).
    /// </summary>
    [JSExport]
    internal static byte[] QuantizeRgba(
        byte[] rgba, int width, int height, int minQuality, int maxQuality, int maxColors, bool dither, int compressionLevel)
    {
        if (width <= 0 || height <= 0 || rgba.Length != checked(width * height * 4))
            throw new ArgumentException($"Expected {width}×{height}×4 bytes of RGBA, got {rgba.Length}.");
        var options = BaseOptions(minQuality, maxQuality, maxColors, dither, compressionLevel) with { SrgbRenderingIntent = 0 };
        return PngWriter.Encode(rgba, width, height, options);
    }

    static PngWriteOptions BaseOptions(int minQuality, int maxQuality, int maxColors, bool dither, int compressionLevel) => new()
    {
        CompressionLevel = (CompressionLevel)compressionLevel,
        Quantize = new PngQuantizeOptions
        {
            MinQuality = minQuality,
            MaxQuality = maxQuality,
            MaxColors = maxColors,
            Dither = dither,
        },
    };
}
