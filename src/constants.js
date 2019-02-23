export var REVISION = '108dev';
export var MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2, ROTATE: 0, DOLLY: 1, PAN: 2 };
export var TOUCH = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 };
export var CullFaceNone = 0;
export var CullFaceBack = 1;
export var CullFaceFront = 2;
export var CullFaceFrontBack = 3;
export var FrontFaceDirectionCW = 0;
export var FrontFaceDirectionCCW = 1;
export var BasicShadowMap = 0;
export var PCFShadowMap = 1;
export var PCFSoftShadowMap = 2;
export var FrontSide = 0;
export var BackSide = 1;
export var DoubleSide = 2;
export var FlatShading = 1;
export var SmoothShading = 2;
export var NoColors = 0;
export var FaceColors = 1;
export var VertexColors = 2;
export var NoBlending = 0;
export var NormalBlending = 1;
export var AdditiveBlending = 2;
export var SubtractiveBlending = 3;
export var MultiplyBlending = 4;
export var CustomBlending = 5;
export var AddEquation = 100;
export var SubtractEquation = 101;
export var ReverseSubtractEquation = 102;
export var MinEquation = 103;
export var MaxEquation = 104;
export var ZeroFactor = 200;
export var OneFactor = 201;
export var SrcColorFactor = 202;
export var OneMinusSrcColorFactor = 203;
export var SrcAlphaFactor = 204;
export var OneMinusSrcAlphaFactor = 205;
export var DstAlphaFactor = 206;
export var OneMinusDstAlphaFactor = 207;
export var DstColorFactor = 208;
export var OneMinusDstColorFactor = 209;
export var SrcAlphaSaturateFactor = 210;
export var NeverDepth = 0;
export var AlwaysDepth = 1;
export var LessDepth = 2;
export var LessEqualDepth = 3;
export var EqualDepth = 4;
export var GreaterEqualDepth = 5;
export var GreaterDepth = 6;
export var NotEqualDepth = 7;
export var MultiplyOperation = 0;
export var MixOperation = 1;
export var AddOperation = 2;
export var NoToneMapping = 0;
export var LinearToneMapping = 1;
export var ReinhardToneMapping = 2;
export var Uncharted2ToneMapping = 3;
export var CineonToneMapping = 4;
export var ACESFilmicToneMapping = 5;

export var UVMapping = 300;
export var CubeReflectionMapping = 301;
export var CubeRefractionMapping = 302;
export var EquirectangularReflectionMapping = 303;
export var EquirectangularRefractionMapping = 304;
export var SphericalReflectionMapping = 305;
export var CubeUVReflectionMapping = 306;
export var CubeUVRefractionMapping = 307;
export var RepeatWrapping = 1000;
export var ClampToEdgeWrapping = 1001;
export var MirroredRepeatWrapping = 1002;
export var NearestFilter = 1003;
export var NearestMipmapNearestFilter = 1004;
export var NearestMipMapNearestFilter = 1004;
export var NearestMipmapLinearFilter = 1005;
export var NearestMipMapLinearFilter = 1005;
export var LinearFilter = 1006;
export var LinearMipmapNearestFilter = 1007;
export var LinearMipMapNearestFilter = 1007;
export var LinearMipmapLinearFilter = 1008;
export var LinearMipMapLinearFilter = 1008;
export var UnsignedByteType = 1009;
export var ByteType = 1010;
export var ShortType = 1011;
export var UnsignedShortType = 1012;
export var IntType = 1013;
export var UnsignedIntType = 1014;
export var FloatType = 1015;
export var HalfFloatType = 1016;
export var UnsignedShort4444Type = 1017;
export var UnsignedShort5551Type = 1018;
export var UnsignedShort565Type = 1019;
export var UnsignedInt248Type = 1020;
export var AlphaFormat = 1021;
export var RGBFormat = 1022;
export var RGBAFormat = 1023;
export var LuminanceFormat = 1024;
export var LuminanceAlphaFormat = 1025;
export var RGBEFormat = RGBAFormat;
export var DepthFormat = 1026;
export var DepthStencilFormat = 1027;
export var RedFormat = 1028;

export var RedIntegerFormat = 1029;
export var R8Format = 1030;
export var R8_SNORMFormat = 1031;
export var R8IFormat = 1032;
export var R8UIFormat = 1033;
export var R16IFormat = 1034;
export var R16UIFormat = 1035;
export var R16FFormat = 1036;
export var R32IFormat = 1037;
export var R32UIFormat = 1038;
export var R32FFormat = 1039;
export var RGFormat = 1040;
export var RGIntegerFormat = 1041;
export var RGBIntegerFormat = 1042;
export var RGBAIntegerFormat = 1043;
export var RG8Format = 1044;
export var RG8_SNORMFormat = 1045;
export var RG8IFormat = 1046;
export var RG8UIFormat = 1047;
export var RG16IFormat = 1048;
export var RG16UIFormat = 1049;
export var RG16FFormat = 1050;
export var RG32IFormat = 1051;
export var RG32UIFormat = 1052;
export var RG32FFormat = 1053;
export var RGB565Format = 1054;
export var RGB8Format = 1055;
export var RGB8_SNORMFormat = 1056;
export var RGB8IFormat = 1057;
export var RGB8UIFormat = 1058;
export var RGB9_E5Format = 1059;
export var RGB16IFormat = 1060;
export var RGB16UIFormat = 1061;
export var RGB16FFormat = 1062;
export var RGB32IFormat = 1063;
export var RGB32UIFormat = 1064;
export var RGB32FFormat = 1065;
export var SRGB8Format = 1066;
export var R11F_G11F_B10FFormat = 1067;
export var RGBA4Format = 1068;
export var RGBA8Format = 1069;
export var RGBA8_SNORMFormat = 1070;
export var RGBA8IFormat = 1071;
export var RGBA8UIFormat = 1072;
export var RGBA16IFormat = 1073;
export var RGBA16UIFormat = 1074;
export var RGBA16FFormat = 1075;
export var RGBA32IFormat = 1076;
export var RGBA32UIFormat = 1077;
export var RGBA32FFormat = 1078;
export var RGB5_A1Format = 1079;
export var RGB10_A2Format = 1080;
export var RGB10_A2UIFormat = 1081;
export var SRGB8_ALPHA8Format = 1082;

export var RGB_S3TC_DXT1_Format = 33776;
export var RGBA_S3TC_DXT1_Format = 33777;
export var RGBA_S3TC_DXT3_Format = 33778;
export var RGBA_S3TC_DXT5_Format = 33779;
export var RGB_PVRTC_4BPPV1_Format = 35840;
export var RGB_PVRTC_2BPPV1_Format = 35841;
export var RGBA_PVRTC_4BPPV1_Format = 35842;
export var RGBA_PVRTC_2BPPV1_Format = 35843;
export var RGB_ETC1_Format = 36196;
export var RGBA_ASTC_4x4_Format = 37808;
export var RGBA_ASTC_5x4_Format = 37809;
export var RGBA_ASTC_5x5_Format = 37810;
export var RGBA_ASTC_6x5_Format = 37811;
export var RGBA_ASTC_6x6_Format = 37812;
export var RGBA_ASTC_8x5_Format = 37813;
export var RGBA_ASTC_8x6_Format = 37814;
export var RGBA_ASTC_8x8_Format = 37815;
export var RGBA_ASTC_10x5_Format = 37816;
export var RGBA_ASTC_10x6_Format = 37817;
export var RGBA_ASTC_10x8_Format = 37818;
export var RGBA_ASTC_10x10_Format = 37819;
export var RGBA_ASTC_12x10_Format = 37820;
export var RGBA_ASTC_12x12_Format = 37821;
export var LoopOnce = 2200;
export var LoopRepeat = 2201;
export var LoopPingPong = 2202;
export var InterpolateDiscrete = 2300;
export var InterpolateLinear = 2301;
export var InterpolateSmooth = 2302;
export var ZeroCurvatureEnding = 2400;
export var ZeroSlopeEnding = 2401;
export var WrapAroundEnding = 2402;
export var TrianglesDrawMode = 0;
export var TriangleStripDrawMode = 1;
export var TriangleFanDrawMode = 2;
export var LinearEncoding = 3000;
export var sRGBEncoding = 3001;
export var GammaEncoding = 3007;
export var RGBEEncoding = 3002;
export var LogLuvEncoding = 3003;
export var RGBM7Encoding = 3004;
export var RGBM16Encoding = 3005;
export var RGBDEncoding = 3006;
export var BasicDepthPacking = 3200;
export var RGBADepthPacking = 3201;
export var TangentSpaceNormalMap = 0;
export var ObjectSpaceNormalMap = 1;

export var ZeroStencilOp = 0;
export var KeepStencilOp = 7680;
export var ReplaceStencilOp = 7681;
export var IncrementStencilOp = 7682;
export var DecrementStencilOp = 7683;
export var IncrementWrapStencilOp = 34055;
export var DecrementWrapStencilOp = 34056;
export var InvertStencilOp = 5386;

export var NeverStencilFunc = 512;
export var LessStencilFunc = 513;
export var EqualStencilFunc = 514;
export var LessEqualStencilFunc = 515;
export var GreaterStencilFunc = 516;
export var NotEqualStencilFunc = 517;
export var GreaterEqualStencilFunc = 518;
export var AlwaysStencilFunc = 519;
