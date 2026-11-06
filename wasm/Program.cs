using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Sdcb.SimdCodecs.Png;

// Nothing runs at start-up: the worker calls the exports below.
return;

[SupportedOSPlatform("browser")]
static partial class Quantizer
{
    /// <summary>
    /// Decodes a PNG and writes it again as a palette PNG (at most <paramref name="maxColors"/> colours, alpha included),
    /// keeping its colour-space chunks. Throws on a file that is not a valid PNG.
    /// </summary>
    [JSExport]
    internal static byte[] Quantize(byte[] png, int minQuality, int maxQuality, int maxColors, bool dither)
    {
        var image = PngReader.Decode(png);
        var rgba = new byte[checked(image.Width * image.Height * 4)];
        image.ExpandToRgba8(rgba);
        var options = new PngWriteOptions
        {
            IccProfile = image.IccProfile,
            SrgbRenderingIntent = image.SrgbRenderingIntent,
            Gamma = image.Gamma,
            Chromaticity = image.Chromaticity,
            Cicp = image.Cicp,
            Quantize = new PngQuantizeOptions
            {
                MinQuality = minQuality,
                MaxQuality = maxQuality,
                MaxColors = maxColors,
                Dither = dither,
            },
        };
        if (image.IccProfileName is { } name) options = options with { IccProfileName = name };
        return PngWriter.Encode(rgba, image.Width, image.Height, options);
    }
}
