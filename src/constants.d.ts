export const REVISION: string;

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent.button
export enum MOUSE {
	LEFT,
	MIDDLE,
	RIGHT,
	ROTATE,
	DOLLY,
	PAN,
}

export enum TOUCH {
	ROTATE,
	PAN,
	DOLLY_PAN,
	DOLLY_ROTATE,
}

// GL STATE CONSTANTS
export enum CullFace {}
export const CullFaceNone: CullFace;
export const CullFaceBack: CullFace;
export const CullFaceFront: CullFace;
export const CullFaceFrontBack: CullFace;

export enum FrontFaceDirection {}
export const FrontFaceDirectionCW: FrontFaceDirection;
export const FrontFaceDirectionCCW: FrontFaceDirection;

// Shadowing Type
export enum ShadowMapType {}
export const BasicShadowMap: ShadowMapType;
export const PCFShadowMap: ShadowMapType;
export const PCFSoftShadowMap: ShadowMapType;

// MATERIAL CONSTANTS

// side
export enum Side {}
export const FrontSide: Side;
export const BackSide: Side;
export const DoubleSide: Side;

// shading
export enum Shading {}
export const FlatShading: Shading;
export const SmoothShading: Shading;

// colors
export enum Colors {}
export const NoColors: Colors;
export const FaceColors: Colors;
export const VertexColors: Colors;

// blending modes
export enum Blending {}
export const NoBlending: Blending;
export const NormalBlending: Blending;
export const AdditiveBlending: Blending;
export const SubtractiveBlending: Blending;
export const MultiplyBlending: Blending;
export const CustomBlending: Blending;

// custom blending equations
// (numbers start from 100 not to clash with other
// mappings to OpenGL constants defined in Texture.js)
export enum BlendingEquation {}
export const AddEquation: BlendingEquation;
export const SubtractEquation: BlendingEquation;
export const ReverseSubtractEquation: BlendingEquation;
export const MinEquation: BlendingEquation;
export const MaxEquation: BlendingEquation;

// custom blending destination factors
export enum BlendingDstFactor {}
export const ZeroFactor: BlendingDstFactor;
export const OneFactor: BlendingDstFactor;
export const SrcColorFactor: BlendingDstFactor;
export const OneMinusSrcColorFactor: BlendingDstFactor;
export const SrcAlphaFactor: BlendingDstFactor;
export const OneMinusSrcAlphaFactor: BlendingDstFactor;
export const DstAlphaFactor: BlendingDstFactor;
export const OneMinusDstAlphaFactor: BlendingDstFactor;
export const DstColorFactor: BlendingDstFactor;
export const OneMinusDstColorFactor: BlendingDstFactor;

// custom blending src factors
export enum BlendingSrcFactor {}
export const SrcAlphaSaturateFactor: BlendingSrcFactor;

// depth modes
export enum DepthModes {}
export const NeverDepth: DepthModes;
export const AlwaysDepth: DepthModes;
export const LessDepth: DepthModes;
export const LessEqualDepth: DepthModes;
export const EqualDepth: DepthModes;
export const GreaterEqualDepth: DepthModes;
export const GreaterDepth: DepthModes;
export const NotEqualDepth: DepthModes;

// TEXTURE CONSTANTS
// Operations
export enum Combine {}
export const MultiplyOperation: Combine;
export const MixOperation: Combine;
export const AddOperation: Combine;

// Tone Mapping modes
export enum ToneMapping {}
export const NoToneMapping: ToneMapping;
export const LinearToneMapping: ToneMapping;
export const ReinhardToneMapping: ToneMapping;
export const Uncharted2ToneMapping: ToneMapping;
export const CineonToneMapping: ToneMapping;

// Mapping modes
export enum Mapping {}
export const UVMapping: Mapping;
export const CubeReflectionMapping: Mapping;
export const CubeRefractionMapping: Mapping;
export const EquirectangularReflectionMapping: Mapping;
export const EquirectangularRefractionMapping: Mapping;
export const SphericalReflectionMapping: Mapping;
export const CubeUVReflectionMapping: Mapping;
export const CubeUVRefractionMapping: Mapping;

// Wrapping modes
export enum Wrapping {}
export const RepeatWrapping: Wrapping;
export const ClampToEdgeWrapping: Wrapping;
export const MirroredRepeatWrapping: Wrapping;

// Filters
export enum TextureFilter {}
export const NearestFilter: TextureFilter;
export const NearestMipmapNearestFilter: TextureFilter;
export const NearestMipMapNearestFilter: TextureFilter;
export const NearestMipmapLinearFilter: TextureFilter;
export const NearestMipMapLinearFilter: TextureFilter;
export const LinearFilter: TextureFilter;
export const LinearMipmapNearestFilter: TextureFilter;
export const LinearMipMapNearestFilter: TextureFilter;
export const LinearMipmapLinearFilter: TextureFilter;
export const LinearMipMapLinearFilter: TextureFilter;

// Data types
export enum TextureDataType {}
export const UnsignedByteType: TextureDataType;
export const ByteType: TextureDataType;
export const ShortType: TextureDataType;
export const UnsignedShortType: TextureDataType;
export const IntType: TextureDataType;
export const UnsignedIntType: TextureDataType;
export const FloatType: TextureDataType;
export const HalfFloatType: TextureDataType;

// Pixel types
export enum PixelType {}
export const UnsignedShort4444Type: PixelType;
export const UnsignedShort5551Type: PixelType;
export const UnsignedShort565Type: PixelType;
export const UnsignedInt248Type: PixelType;

// Pixel formats
export enum PixelFormat {}
export const AlphaFormat: PixelFormat;
export const RGBFormat: PixelFormat;
export const RGBAFormat: PixelFormat;
export const LuminanceFormat: PixelFormat;
export const LuminanceAlphaFormat: PixelFormat;
export const RGBEFormat: PixelFormat;
export const DepthFormat: PixelFormat;
export const DepthStencilFormat: PixelFormat;
export const RedFormat: PixelFormat;

// Internal Pixel Formats
export enum PixelFormatInternal {}
export const RedIntegerFormat: PixelFormatInternal;
export const R8Format: PixelFormatInternal;
export const R8_SNORMFormat: PixelFormatInternal;
export const R8IFormat: PixelFormatInternal;
export const R8UIFormat: PixelFormatInternal;
export const R16IFormat: PixelFormatInternal;
export const R16UIFormat: PixelFormatInternal;
export const R16FFormat: PixelFormatInternal;
export const R32IFormat: PixelFormatInternal;
export const R32UIFormat: PixelFormatInternal;
export const R32FFormat: PixelFormatInternal;
export const RGFormat: PixelFormatInternal;
export const RGIntegerFormat: PixelFormatInternal;
export const RGBIntegerFormat: PixelFormatInternal;
export const RGBAIntegerFormat: PixelFormatInternal;
export const RG8Format: PixelFormatInternal;
export const RG8_SNORMFormat: PixelFormatInternal;
export const RG8IFormat: PixelFormatInternal;
export const RG8UIFormat: PixelFormatInternal;
export const RG16IFormat: PixelFormatInternal;
export const RG16UIFormat: PixelFormatInternal;
export const RG16FFormat: PixelFormatInternal;
export const RG32IFormat: PixelFormatInternal;
export const RG32UIFormat: PixelFormatInternal;
export const RG32FFormat: PixelFormatInternal;
export const RGB565Format: PixelFormatInternal;
export const RGB8Format: PixelFormatInternal;
export const RGB8_SNORMFormat: PixelFormatInternal;
export const RGB8IFormat: PixelFormatInternal;
export const RGB8UIFormat: PixelFormatInternal;
export const RGB9_E5Format: PixelFormatInternal;
export const RGB16IFormat: PixelFormatInternal;
export const RGB16UIFormat: PixelFormatInternal;
export const RGB16FFormat: PixelFormatInternal;
export const RGB32IFormat: PixelFormatInternal;
export const RGB32UIFormat: PixelFormatInternal;
export const RGB32FFormat: PixelFormatInternal;
export const SRGB8Format: PixelFormatInternal;
export const R11F_G11F_B10FFormat: PixelFormatInternal;
export const RGBA4Format: PixelFormatInternal;
export const RGBA8Format: PixelFormatInternal;
export const RGBA8_SNORMFormat: PixelFormatInternal;
export const RGBA8IFormat: PixelFormatInternal;
export const RGBA8UIFormat: PixelFormatInternal;
export const RGBA16IFormat: PixelFormatInternal;
export const RGBA16UIFormat: PixelFormatInternal;
export const RGBA16FFormat: PixelFormatInternal;
export const RGBA32IFormat: PixelFormatInternal;
export const RGBA32UIFormat: PixelFormatInternal;
export const RGBA32FFormat: PixelFormatInternal;
export const RGB5_A1Format: PixelFormatInternal;
export const RGB10_A2Format: PixelFormatInternal;
export const RGB10_A2UIFormat: PixelFormatInternal;
export const SRGB8_ALPHA8Format: PixelFormatInternal;

// Compressed texture formats
// DDS / ST3C Compressed texture formats
export enum CompressedPixelFormat {}
export const RGB_S3TC_DXT1_Format: CompressedPixelFormat;
export const RGBA_S3TC_DXT1_Format: CompressedPixelFormat;
export const RGBA_S3TC_DXT3_Format: CompressedPixelFormat;
export const RGBA_S3TC_DXT5_Format: CompressedPixelFormat;

// PVRTC compressed './texture formats
export const RGB_PVRTC_4BPPV1_Format: CompressedPixelFormat;
export const RGB_PVRTC_2BPPV1_Format: CompressedPixelFormat;
export const RGBA_PVRTC_4BPPV1_Format: CompressedPixelFormat;
export const RGBA_PVRTC_2BPPV1_Format: CompressedPixelFormat;

// ETC compressed texture formats
export const RGB_ETC1_Format: CompressedPixelFormat;

// ASTC compressed texture formats
export const RGBA_ASTC_4x4_Format: CompressedPixelFormat;
export const RGBA_ASTC_5x4_Format: CompressedPixelFormat;
export const RGBA_ASTC_5x5_Format: CompressedPixelFormat;
export const RGBA_ASTC_6x5_Format: CompressedPixelFormat;
export const RGBA_ASTC_6x6_Format: CompressedPixelFormat;
export const RGBA_ASTC_8x5_Format: CompressedPixelFormat;
export const RGBA_ASTC_8x6_Format: CompressedPixelFormat;
export const RGBA_ASTC_8x8_Format: CompressedPixelFormat;
export const RGBA_ASTC_10x5_Format: CompressedPixelFormat;
export const RGBA_ASTC_10x6_Format: CompressedPixelFormat;
export const RGBA_ASTC_10x8_Format: CompressedPixelFormat;
export const RGBA_ASTC_10x10_Format: CompressedPixelFormat;
export const RGBA_ASTC_12x10_Format: CompressedPixelFormat;
export const RGBA_ASTC_12x12_Format: CompressedPixelFormat;

// Loop styles for AnimationAction
export enum AnimationActionLoopStyles {}
export const LoopOnce: AnimationActionLoopStyles;
export const LoopRepeat: AnimationActionLoopStyles;
export const LoopPingPong: AnimationActionLoopStyles;

// Interpolation
export enum InterpolationModes {}
export const InterpolateDiscrete: InterpolationModes;
export const InterpolateLinear: InterpolationModes;
export const InterpolateSmooth: InterpolationModes;

// Interpolant ending modes
export enum InterpolationEndingModes {}
export const ZeroCurvatureEnding: InterpolationEndingModes;
export const ZeroSlopeEnding: InterpolationEndingModes;
export const WrapAroundEnding: InterpolationEndingModes;

// Triangle Draw modes
export enum TrianglesDrawModes {}
export const TrianglesDrawMode: TrianglesDrawModes;
export const TriangleStripDrawMode: TrianglesDrawModes;
export const TriangleFanDrawMode: TrianglesDrawModes;

// Texture Encodings
export enum TextureEncoding {}
export const LinearEncoding: TextureEncoding;
export const sRGBEncoding: TextureEncoding;
export const GammaEncoding: TextureEncoding;
export const RGBEEncoding: TextureEncoding;
export const LogLuvEncoding: TextureEncoding;
export const RGBM7Encoding: TextureEncoding;
export const RGBM16Encoding: TextureEncoding;
export const RGBDEncoding: TextureEncoding;

// Depth packing strategies
export enum DepthPackingStrategies {}
export const BasicDepthPacking: DepthPackingStrategies;
export const RGBADepthPacking: DepthPackingStrategies;

// Normal Map types
export enum NormalMapTypes {}
export const TangentSpaceNormalMap: NormalMapTypes;
export const ObjectSpaceNormalMap: NormalMapTypes;

// Stencil Op types
export enum StencilOp {}
export const ZeroStencilOp: StencilOp;
export const KeepStencilOp: StencilOp;
export const ReplaceStencilOp: StencilOp;
export const IncrementStencilOp: StencilOp;
export const DecrementStencilOp: StencilOp;
export const IncrementWrapStencilOp: StencilOp;
export const DecrementWrapStencilOp: StencilOp;
export const InvertStencilOp: StencilOp;

// Stencil Func types
export enum StencilFunc {}
export const NeverStencilFunc: StencilFunc;
export const LessStencilFunc: StencilFunc;
export const EqualStencilFunc: StencilFunc;
export const LessEqualStencilFunc: StencilFunc;
export const GreaterStencilFunc: StencilFunc;
export const NotEqualStencilFunc: StencilFunc;
export const GreaterEqualStencilFunc: StencilFunc;
export const AlwaysStencilFunc: StencilFunc;
