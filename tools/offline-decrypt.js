(() => {
  // src/features/feature-inplace-encrypt/Decryptable.ts
  var Decryptable = class {
  };

  // src/features/feature-inplace-encrypt/FeatureInplaceConstants.ts
  var ENCRYPTED_ICON = "\u{1F6E1}\uFE0F";
  var INPLACE_FORMAT_TAG_V2 = "@v2";
  var INPLACE_VERSION_V2 = 2;
  var _PREFIX_V2 = `%%${ENCRYPTED_ICON}\`${INPLACE_FORMAT_TAG_V2} `;
  var _PREFIX_V2_VISIBLE = `${ENCRYPTED_ICON}\`${INPLACE_FORMAT_TAG_V2} `;
  var INPLACE_FORMATS = [
    {
      version: INPLACE_VERSION_V2,
      hiddenPrefix: _PREFIX_V2,
      visiblePrefix: _PREFIX_V2_VISIBLE
    }
  ];
  var _PREFIX_ENCODE_DEFAULT = _PREFIX_V2;
  var _PREFIX_ENCODE_DEFAULT_VISIBLE = _PREFIX_V2_VISIBLE;
  var _PREFIXES = INPLACE_FORMATS.reduce((prefixes, format) => {
    prefixes.push(format.hiddenPrefix, format.visiblePrefix);
    return prefixes;
  }, []);
  var _VISIBLE_PREFIXES = INPLACE_FORMATS.map((format) => format.visiblePrefix);
  var _SUFFIX_WITH_COMMENT = "`\u{1F6E1}\uFE0F%%";
  var _SUFFIX_NO_COMMENT = "`\u{1F6E1}\uFE0F";
  var _SUFFIXES = [
    _SUFFIX_WITH_COMMENT,
    _SUFFIX_NO_COMMENT
  ];
  var _HINT = "\u{1F4A1}";

  // src/features/feature-inplace-encrypt/featureInplaceTextAnalysis.ts
  var FeatureInplaceTextAnalysis = class {
    constructor(text) {
      this.process(text);
    }
    process(text) {
      var _a, _b;
      this.processedText = text;
      this.isEmpty = text.length === 0;
      this.prefix = (_a = _PREFIXES.find((prefix) => text.startsWith(prefix))) != null ? _a : "";
      this.suffix = (_b = _SUFFIXES.find((suffix) => text.endsWith(suffix))) != null ? _b : "";
      this.hasEncryptedPrefix = this.prefix.length > 0;
      this.hasEncryptedSuffix = this.suffix.length > 0;
      this.containsEncryptedMarkers = [..._PREFIXES, ..._SUFFIXES].some((marker) => text.includes(marker));
      this.canDecrypt = this.hasEncryptedPrefix && this.hasEncryptedSuffix;
      this.canEncrypt = !this.hasEncryptedPrefix && !this.containsEncryptedMarkers;
      if (this.canDecrypt) {
        const decryptable = this.parseDecryptableContent(text);
        if (decryptable != null) {
          this.decryptable = decryptable;
        } else {
          this.canDecrypt = false;
        }
      }
    }
    getFormatForPrefix(prefix) {
      var _a;
      return (_a = INPLACE_FORMATS.find((format) => format.hiddenPrefix === prefix || format.visiblePrefix === prefix)) != null ? _a : null;
    }
    parseDecryptableContent(text) {
      const result = new Decryptable();
      if (!this.hasEncryptedPrefix || !this.hasEncryptedSuffix) {
        return null;
      }
      const format = this.getFormatForPrefix(this.prefix);
      if (format == null) {
        return null;
      }
      result.version = format.version;
      const content = text.substring(this.prefix.length, text.length - this.suffix.length);
      if ([..._PREFIXES, ..._SUFFIXES].some((marker) => content.includes(marker))) {
        return null;
      }
      if (content.substring(0, _HINT.length) == _HINT) {
        const endHintMarker = content.indexOf(_HINT, _HINT.length);
        if (endHintMarker < 0) {
          return null;
        }
        result.hint = content.substring(_HINT.length, endHintMarker);
        result.base64CipherText = content.substring(endHintMarker + _HINT.length);
      } else {
        result.base64CipherText = content;
      }
      result.showInReadingView = this.prefix === format.visiblePrefix;
      return result;
    }
  };

  // src/services/CryptoHelper2304.ts
  var CryptoHelper2304 = class {
    constructor(vectorSize, saltSize, iterations) {
      this.vectorSize = vectorSize;
      this.saltSize = saltSize;
      this.iterations = iterations;
    }
    async deriveKey(password, salt) {
      const utf8Encoder = new TextEncoder();
      const buffer = utf8Encoder.encode(password);
      const key = await crypto.subtle.importKey(
        /*format*/
        "raw",
        /*keyData*/
        buffer,
        /*algorithm*/
        "PBKDF2",
        /*extractable*/
        false,
        /*keyUsages*/
        ["deriveKey"]
      );
      try {
        const privateKey = await crypto.subtle.deriveKey(
          /*algorithm*/
          {
            name: "PBKDF2",
            hash: "SHA-512",
            salt,
            iterations: this.iterations
          },
          /*baseKey*/
          key,
          /*derivedKeyAlgorithm*/
          {
            name: "AES-GCM",
            length: 256
          },
          /*extractable*/
          false,
          /*keyUsages*/
          ["encrypt", "decrypt"]
        );
        return privateKey;
      } finally {
      }
    }
    async encryptToBytes(text, password) {
      const salt = crypto.getRandomValues(new Uint8Array(this.saltSize));
      const key = await this.deriveKey(password, salt);
      const utf8Encoder = new TextEncoder();
      const textBytesToEncrypt = utf8Encoder.encode(text);
      const vector = crypto.getRandomValues(new Uint8Array(this.vectorSize));
      const encryptedBytes = new Uint8Array(
        await crypto.subtle.encrypt(
          /*algorithm*/
          {
            name: "AES-GCM",
            iv: vector
          },
          /*key*/
          key,
          /*data*/
          textBytesToEncrypt
        )
      );
      const finalBytes = new Uint8Array(vector.byteLength + salt.byteLength + encryptedBytes.byteLength);
      finalBytes.set(vector, 0);
      finalBytes.set(salt, vector.byteLength);
      finalBytes.set(encryptedBytes, vector.byteLength + salt.byteLength);
      return finalBytes;
    }
    convertToString(bytes) {
      let result = "";
      for (let idx = 0; idx < bytes.length; idx++) {
        result += String.fromCharCode(bytes[idx]);
      }
      return result;
    }
    async encryptToBase64(text, password) {
      const finalBytes = await this.encryptToBytes(text, password);
      const base64Text = btoa(this.convertToString(finalBytes));
      return base64Text;
    }
    stringToArray(str) {
      const result = [];
      for (let i = 0; i < str.length; i++) {
        result.push(str.charCodeAt(i));
      }
      return new Uint8Array(result);
    }
    async decryptFromBytes(encryptedBytes, password) {
      try {
        let offset;
        let nextOffset;
        offset = 0;
        nextOffset = offset + this.vectorSize;
        const vector = encryptedBytes.slice(offset, nextOffset);
        offset = nextOffset;
        nextOffset = offset + this.saltSize;
        const salt = encryptedBytes.slice(offset, nextOffset);
        offset = nextOffset;
        nextOffset = void 0;
        const encryptedTextBytes = encryptedBytes.slice(offset);
        const key = await this.deriveKey(password, salt);
        const decryptedBytes = await crypto.subtle.decrypt(
          /*algorithm*/
          {
            name: "AES-GCM",
            iv: vector
          },
          /*key*/
          key,
          /*data*/
          encryptedTextBytes
        );
        const utf8Decoder = new TextDecoder();
        const decryptedText = utf8Decoder.decode(decryptedBytes);
        return decryptedText;
      } catch (e) {
        return null;
      }
    }
    async decryptFromBase64(base64Encoded, password) {
      try {
        const bytesToDecode = this.stringToArray(atob(base64Encoded));
        return await this.decryptFromBytes(bytesToDecode, password);
      } catch (e) {
        return null;
      }
    }
  };

  // src/services/CryptoHelperFactory.ts
  var _CryptoHelperFactory = class _CryptoHelperFactory {
    static BuildDefault() {
      return this.cryptoHelper2304_v2;
    }
    static BuildFromFileDataOrThrow(data) {
      const result = _CryptoHelperFactory.BuildFromFileDataOrNull(data);
      if (result != null) {
        return result;
      }
      throw new Error(`Unable to determine ICryptoHelper for File ver ${data.version}`);
    }
    static BuildFromFileDataOrNull(data) {
      switch (data.version) {
        case "2.0":
          return this.cryptoHelper2304_v2;
        default:
          return null;
      }
    }
    static BuildFromDecryptableOrThrow(decryptable) {
      const result = _CryptoHelperFactory.BuildFromDecryptableOrNull(decryptable);
      if (result != null) {
        return result;
      }
      throw new Error(`Unable to determine ICryptoHelper for Decryptable ver ${decryptable.version}`);
    }
    static BuildFromDecryptableOrNull(decryptable) {
      switch (decryptable.version) {
        case 2:
          return this.cryptoHelper2304_v2;
        default:
          return null;
      }
    }
  };
  _CryptoHelperFactory.cryptoHelper2304_v2 = new CryptoHelper2304(16, 16, 21e4);
  var CryptoHelperFactory = _CryptoHelperFactory;

  // src/services/FileDataHelper.ts
  var FileData2 = class {
    constructor(version, hint, encodedData) {
      this.version = "2.0";
      this.version = version;
      this.hint = hint;
      this.encodedData = encodedData;
    }
  };
  var _FileDataHelper = class _FileDataHelper {
    static async encrypt(pass, hint, text) {
      const crypto2 = CryptoHelperFactory.BuildDefault();
      const encryptedData = await crypto2.encryptToBase64(text, pass);
      return new FileData2(_FileDataHelper.DEFAULT_VERSION, hint, encryptedData);
    }
    static async decrypt(data, pass) {
      if (data.encodedData == "") {
        return "";
      }
      const crypto2 = CryptoHelperFactory.BuildFromFileDataOrThrow(data);
      return await crypto2.decryptFromBase64(data.encodedData, pass);
    }
  };
  _FileDataHelper.DEFAULT_VERSION = "2.0";
  var FileDataHelper = _FileDataHelper;
  var JsonFileEncoding = class {
    static encode(data) {
      return JSON.stringify(data, null, 2);
    }
    static isEncoded(text) {
      try {
        JSON.parse(text);
        return true;
      } catch (error) {
        return false;
      }
    }
    static decode(encodedText) {
      if (encodedText === "") {
        return new FileData2(FileDataHelper.DEFAULT_VERSION, "", "");
      }
      return JSON.parse(encodedText);
    }
  };

  // src/tools/offline-decrypt.ts
  var OfflineDecrypt = class {
    async decrypt(content, password) {
      console.info("Trying the default decryption");
      const chDef = CryptoHelperFactory.BuildDefault();
      const result = await chDef.decryptFromBase64(content, password);
      if (result != null) {
        return result;
      }
      console.info("Trying marked inplace feature decryption");
      const ta = new FeatureInplaceTextAnalysis(content);
      if (ta.decryptable != null) {
        const ch = CryptoHelperFactory.BuildFromDecryptableOrNull(ta.decryptable);
        if (ch != null) {
          const result2 = await ch.decryptFromBase64(ta.decryptable.base64CipherText, password);
          if (result2 != null) {
            return result2;
          }
        }
      }
      console.info("Trying whole note feature decryption");
      try {
        const fileData = JsonFileEncoding.decode(content);
        console.debug(fileData);
        const chFd = CryptoHelperFactory.BuildFromFileDataOrNull(fileData);
        const resultFd = await (chFd == null ? void 0 : chFd.decryptFromBase64(fileData.encodedData, password));
        if (resultFd != null) {
          return resultFd;
        }
      } catch (e) {
        console.info(e);
      }
      return null;
    }
  };
  window.$ = new OfflineDecrypt();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2ZlYXR1cmVzL2ZlYXR1cmUtaW5wbGFjZS1lbmNyeXB0L0RlY3J5cHRhYmxlLnRzIiwgIi4uL3NyYy9mZWF0dXJlcy9mZWF0dXJlLWlucGxhY2UtZW5jcnlwdC9GZWF0dXJlSW5wbGFjZUNvbnN0YW50cy50cyIsICIuLi9zcmMvZmVhdHVyZXMvZmVhdHVyZS1pbnBsYWNlLWVuY3J5cHQvZmVhdHVyZUlucGxhY2VUZXh0QW5hbHlzaXMudHMiLCAiLi4vc3JjL3NlcnZpY2VzL0NyeXB0b0hlbHBlcjIzMDQudHMiLCAiLi4vc3JjL3NlcnZpY2VzL0NyeXB0b0hlbHBlckZhY3RvcnkudHMiLCAiLi4vc3JjL3NlcnZpY2VzL0ZpbGVEYXRhSGVscGVyLnRzIiwgIi4uL3NyYy90b29scy9vZmZsaW5lLWRlY3J5cHQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBjbGFzcyBEZWNyeXB0YWJsZXtcblx0dmVyc2lvbjogbnVtYmVyO1xuXHRiYXNlNjRDaXBoZXJUZXh0OnN0cmluZztcblx0aGludDpzdHJpbmc7XG5cdHNob3dJblJlYWRpbmdWaWV3OiBib29sZWFuO1xufSIsICJcbmV4cG9ydCBjb25zdCBFTkNSWVBURURfSUNPTiA9ICdcdUQ4M0RcdURFRTFcdUZFMEYnO1xuZXhwb3J0IGNvbnN0IElOUExBQ0VfRk9STUFUX1RBR19WMiA9ICdAdjInO1xuZXhwb3J0IGNvbnN0IElOUExBQ0VfVkVSU0lPTl9WMiA9IDI7XG5cbmV4cG9ydCBjb25zdCBfUFJFRklYX1YyID0gYCUlJHtFTkNSWVBURURfSUNPTn1cXGAke0lOUExBQ0VfRk9STUFUX1RBR19WMn0gYDtcbmV4cG9ydCBjb25zdCBfUFJFRklYX1YyX1ZJU0lCTEUgPSBgJHtFTkNSWVBURURfSUNPTn1cXGAke0lOUExBQ0VfRk9STUFUX1RBR19WMn0gYDtcblxuZXhwb3J0IGludGVyZmFjZSBJblBsYWNlRm9ybWF0RGVmaW5pdGlvbntcblx0dmVyc2lvbjogbnVtYmVyO1xuXHRoaWRkZW5QcmVmaXg6IHN0cmluZztcblx0dmlzaWJsZVByZWZpeDogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgSU5QTEFDRV9GT1JNQVRTOiBJblBsYWNlRm9ybWF0RGVmaW5pdGlvbltdID0gW1xuXHR7XG5cdFx0dmVyc2lvbjogSU5QTEFDRV9WRVJTSU9OX1YyLFxuXHRcdGhpZGRlblByZWZpeDogX1BSRUZJWF9WMixcblx0XHR2aXNpYmxlUHJlZml4OiBfUFJFRklYX1YyX1ZJU0lCTEVcblx0fVxuXTtcblxuZXhwb3J0IGNvbnN0IF9QUkVGSVhfRU5DT0RFX0RFRkFVTFQgPSBfUFJFRklYX1YyO1xuZXhwb3J0IGNvbnN0IF9QUkVGSVhfRU5DT0RFX0RFRkFVTFRfVklTSUJMRSA9IF9QUkVGSVhfVjJfVklTSUJMRTtcblxuLy8gU2hvdWxkIGJlIGxpc3RlZCBieSBldmFsdWF0aW9uIHByaW9yaXR5XG5leHBvcnQgY29uc3QgX1BSRUZJWEVTID0gSU5QTEFDRV9GT1JNQVRTLnJlZHVjZSggKHByZWZpeGVzLCBmb3JtYXQpID0+IHtcblx0cHJlZml4ZXMucHVzaChmb3JtYXQuaGlkZGVuUHJlZml4LCBmb3JtYXQudmlzaWJsZVByZWZpeCk7XG5cdHJldHVybiBwcmVmaXhlcztcbn0sIFtdIGFzIHN0cmluZ1tdICk7XG5cbmV4cG9ydCBjb25zdCBfVklTSUJMRV9QUkVGSVhFUyA9IElOUExBQ0VfRk9STUFUUy5tYXAoIGZvcm1hdCA9PiBmb3JtYXQudmlzaWJsZVByZWZpeCApO1xuXG5leHBvcnQgY29uc3QgX1NVRkZJWF9XSVRIX0NPTU1FTlQgPSAnYFx1RDgzRFx1REVFMVx1RkUwRiUlJztcbmV4cG9ydCBjb25zdCBfU1VGRklYX05PX0NPTU1FTlQgPSAnYFx1RDgzRFx1REVFMVx1RkUwRic7XG5cbi8vIFNob3VsZCBiZSBsaXN0ZWQgYnkgZXZhbHVhdGlvbiBwcmlvcml0eVxuZXhwb3J0IGNvbnN0IF9TVUZGSVhFUyA9IFtcblx0X1NVRkZJWF9XSVRIX0NPTU1FTlQsXG5cdF9TVUZGSVhfTk9fQ09NTUVOVFxuXTtcblxuZXhwb3J0IGNvbnN0IF9ISU5UID0gJ1x1RDgzRFx1RENBMSc7XG4iLCAiaW1wb3J0IHsgRGVjcnlwdGFibGUgfSBmcm9tIFwiLi9EZWNyeXB0YWJsZS50c1wiO1xuaW1wb3J0IHsgSU5QTEFDRV9GT1JNQVRTLCBJblBsYWNlRm9ybWF0RGVmaW5pdGlvbiwgX0hJTlQsIF9QUkVGSVhFUywgX1NVRkZJWEVTIH0gZnJvbSBcIi4vRmVhdHVyZUlucGxhY2VDb25zdGFudHMudHNcIjtcblxuZXhwb3J0IGNsYXNzIEZlYXR1cmVJbnBsYWNlVGV4dEFuYWx5c2lze1xuXHRwcm9jZXNzZWRUZXh0OnN0cmluZztcblx0aXNFbXB0eTogYm9vbGVhbjtcblx0XG5cdHByZWZpeDogc3RyaW5nO1xuXHRzdWZmaXg6IHN0cmluZztcblxuXHRoYXNFbmNyeXB0ZWRQcmVmaXg6IGJvb2xlYW47XG5cdGhhc0VuY3J5cHRlZFN1ZmZpeDogYm9vbGVhbjtcblx0Y2FuRGVjcnlwdDogYm9vbGVhbjtcblx0Y2FuRW5jcnlwdDogYm9vbGVhbjtcblx0Y29udGFpbnNFbmNyeXB0ZWRNYXJrZXJzOiBib29sZWFuO1xuXHRkZWNyeXB0YWJsZT8gOiBEZWNyeXB0YWJsZTtcblxuXHRjb25zdHJ1Y3Rvcih0ZXh0OiBzdHJpbmcpe1xuXHRcdHRoaXMucHJvY2Vzcyh0ZXh0KTtcblx0fVxuXG5cdHByaXZhdGUgcHJvY2VzcyggdGV4dDogc3RyaW5nICkgOiB2b2lke1xuXHRcdFxuXHRcdHRoaXMucHJvY2Vzc2VkVGV4dCA9IHRleHQ7XG5cblx0XHR0aGlzLmlzRW1wdHkgPSB0ZXh0Lmxlbmd0aCA9PT0gMDtcblxuXHRcdHRoaXMucHJlZml4ID0gX1BSRUZJWEVTLmZpbmQoIChwcmVmaXgpID0+IHRleHQuc3RhcnRzV2l0aChwcmVmaXgpICkgPz8gJyc7XG5cdFx0dGhpcy5zdWZmaXggPSBfU1VGRklYRVMuZmluZCggKHN1ZmZpeCkgPT4gdGV4dC5lbmRzV2l0aChzdWZmaXgpICkgPz8gJyc7XG5cdFx0XG5cdFx0dGhpcy5oYXNFbmNyeXB0ZWRQcmVmaXggPSB0aGlzLnByZWZpeC5sZW5ndGggPiAwO1xuXHRcdHRoaXMuaGFzRW5jcnlwdGVkU3VmZml4ID0gdGhpcy5zdWZmaXgubGVuZ3RoID4gMDtcblxuXHRcdHRoaXMuY29udGFpbnNFbmNyeXB0ZWRNYXJrZXJzID0gWy4uLl9QUkVGSVhFUywgLi4uX1NVRkZJWEVTXS5zb21lKCAobWFya2VyKSA9PiB0ZXh0LmluY2x1ZGVzKG1hcmtlciApKTtcblxuXHRcdHRoaXMuY2FuRGVjcnlwdCA9IHRoaXMuaGFzRW5jcnlwdGVkUHJlZml4ICYmIHRoaXMuaGFzRW5jcnlwdGVkU3VmZml4O1xuXHRcdHRoaXMuY2FuRW5jcnlwdCA9ICF0aGlzLmhhc0VuY3J5cHRlZFByZWZpeCAmJiAhdGhpcy5jb250YWluc0VuY3J5cHRlZE1hcmtlcnM7XG5cdFx0XG5cdFx0aWYgKHRoaXMuY2FuRGVjcnlwdCl7XG5cdFx0XHRjb25zdCBkZWNyeXB0YWJsZSA9IHRoaXMucGFyc2VEZWNyeXB0YWJsZUNvbnRlbnQodGV4dCk7XG5cblx0XHRcdGlmICggZGVjcnlwdGFibGUgIT0gbnVsbCApe1xuXHRcdFx0XHR0aGlzLmRlY3J5cHRhYmxlID0gZGVjcnlwdGFibGU7XG5cdFx0XHR9ZWxzZXtcblx0XHRcdFx0dGhpcy5jYW5EZWNyeXB0ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRGb3JtYXRGb3JQcmVmaXgocHJlZml4OiBzdHJpbmcpOiBJblBsYWNlRm9ybWF0RGVmaW5pdGlvbiB8IG51bGx7XG5cdFx0cmV0dXJuIElOUExBQ0VfRk9STUFUUy5maW5kKCAoZm9ybWF0KSA9PiAoXG5cdFx0XHRmb3JtYXQuaGlkZGVuUHJlZml4ID09PSBwcmVmaXhcblx0XHRcdHx8IGZvcm1hdC52aXNpYmxlUHJlZml4ID09PSBwcmVmaXhcblx0XHQpICkgPz8gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VEZWNyeXB0YWJsZUNvbnRlbnQodGV4dDogc3RyaW5nKSA6IERlY3J5cHRhYmxlIHwgbnVsbCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IERlY3J5cHRhYmxlKCk7XG5cblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5oYXNFbmNyeXB0ZWRQcmVmaXhcblx0XHRcdHx8ICF0aGlzLmhhc0VuY3J5cHRlZFN1ZmZpeFxuXHRcdCl7XG5cdFx0XHRyZXR1cm4gbnVsbDsgLy8gaW52YWxpZCBmb3JtYXRcblx0XHR9XG5cblx0XHRjb25zdCBmb3JtYXQgPSB0aGlzLmdldEZvcm1hdEZvclByZWZpeCh0aGlzLnByZWZpeCk7XG5cdFx0aWYgKCBmb3JtYXQgPT0gbnVsbCApe1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJlc3VsdC52ZXJzaW9uID0gZm9ybWF0LnZlcnNpb247XG5cblx0XHQvLyByZW1vdmUgbWFya2VycyBmcm9tIHN0YXJ0IGFuZCBlbmRcdFxuXHRcdGNvbnN0IGNvbnRlbnQgPSB0ZXh0LnN1YnN0cmluZyh0aGlzLnByZWZpeC5sZW5ndGgsIHRleHQubGVuZ3RoIC0gdGhpcy5zdWZmaXgubGVuZ3RoKTtcblxuXHRcdGlmICggWy4uLl9QUkVGSVhFUywgLi4uX1NVRkZJWEVTXS5zb21lKCAobWFya2VyKSA9PiBjb250ZW50LmluY2x1ZGVzKCBtYXJrZXIgKSkgKXtcblx0XHRcdC8vIGNvbnRlbnQsIGl0c2VsZiBoYXMgbWFya2Vyc1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgaWYgdGhlcmUgaXMgYSBoaW50XG5cdFx0aWYgKGNvbnRlbnQuc3Vic3RyaW5nKDAsX0hJTlQubGVuZ3RoKSA9PSBfSElOVCl7XG5cdFx0XHRjb25zdCBlbmRIaW50TWFya2VyID0gY29udGVudC5pbmRleE9mKF9ISU5ULF9ISU5ULmxlbmd0aCk7XG5cdFx0XHRpZiAoZW5kSGludE1hcmtlcjwwKXtcblx0XHRcdFx0cmV0dXJuIG51bGw7IC8vIGludmFsaWQgZm9ybWF0XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQuaGludCA9IGNvbnRlbnQuc3Vic3RyaW5nKF9ISU5ULmxlbmd0aCxlbmRIaW50TWFya2VyKVxuXHRcdFx0cmVzdWx0LmJhc2U2NENpcGhlclRleHQgPSBjb250ZW50LnN1YnN0cmluZyhlbmRIaW50TWFya2VyK19ISU5ULmxlbmd0aCk7XG5cdFx0fWVsc2V7XG5cdFx0XHRyZXN1bHQuYmFzZTY0Q2lwaGVyVGV4dCA9IGNvbnRlbnQ7XG5cdFx0fVxuXHRcdHJlc3VsdC5zaG93SW5SZWFkaW5nVmlldyA9IHRoaXMucHJlZml4ID09PSBmb3JtYXQudmlzaWJsZVByZWZpeDtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXG5cdH1cbn1cbiIsICJpbXBvcnQgeyBJQ3J5cHRvSGVscGVyIH0gZnJvbSBcIi4vSUNyeXB0b0hlbHBlci50c1wiO1xuXG5leHBvcnQgY2xhc3MgQ3J5cHRvSGVscGVyMjMwNCBpbXBsZW1lbnRzIElDcnlwdG9IZWxwZXIge1xuXHRwdWJsaWMgdmVjdG9yU2l6ZTogbnVtYmVyO1xuXHRwdWJsaWMgc2FsdFNpemU6IG51bWJlcjtcblx0cHVibGljIGl0ZXJhdGlvbnM6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3RvciggdmVjdG9yU2l6ZTogbnVtYmVyLCBzYWx0U2l6ZTogbnVtYmVyLCBpdGVyYXRpb25zOiBudW1iZXIgKXtcblx0XHQvL2NvbnNvbGUuZGVidWcoJ25ldyBDcnlwdG9IZWxwZXIyMzA0Jywge3ZlY3RvclNpemUsIHNhbHRTaXplLCBpdGVyYXRpb25zfSk7XG5cdFx0dGhpcy52ZWN0b3JTaXplID0gdmVjdG9yU2l6ZTtcblx0XHR0aGlzLnNhbHRTaXplID0gc2FsdFNpemU7XG5cdFx0dGhpcy5pdGVyYXRpb25zID0gaXRlcmF0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGVyaXZlS2V5KCBwYXNzd29yZDpzdHJpbmcsIHNhbHQ6VWludDhBcnJheSApIDpQcm9taXNlPENyeXB0b0tleT4ge1xuXHRcdC8vIGNvbnNvbGUudHJhY2UoJ0NyeXB0b0hlbHBlcjIzMDQuZGVyaXZlS2V5Jyk7XG5cdFx0Ly9TZWU6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9TdWJ0bGVDcnlwdG9cblx0XHRjb25zdCB1dGY4RW5jb2Rlclx0PSBuZXcgVGV4dEVuY29kZXIoKTtcblx0XHRjb25zdCBidWZmZXIgICAgID0gdXRmOEVuY29kZXIuZW5jb2RlKHBhc3N3b3JkKTtcblx0XHRjb25zdCBrZXkgICAgICAgID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5pbXBvcnRLZXkoXG5cdFx0XHQvKmZvcm1hdCovICdyYXcnLFxuXHRcdFx0LyprZXlEYXRhKi8gYnVmZmVyLFxuXHRcdFx0LyphbGdvcml0aG0qLyAnUEJLREYyJyxcblx0XHRcdC8qZXh0cmFjdGFibGUqLyBmYWxzZSxcblx0XHRcdC8qa2V5VXNhZ2VzKi8gWydkZXJpdmVLZXknXVxuXHRcdCk7XG5cdFx0XG5cdFx0Ly9jb25zb2xlLnRpbWUoJ0NyeXB0b0hlbHBlcjIzMDQuZGVyaXZlS2V5Jyk7XG5cdFx0dHJ5e1xuXHRcdFx0Y29uc3QgcHJpdmF0ZUtleSA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGVyaXZlS2V5KFxuXHRcdFx0XHQvKmFsZ29yaXRobSovIHtcblx0XHRcdFx0XHRuYW1lOiAnUEJLREYyJyxcblx0XHRcdFx0XHRoYXNoOiAnU0hBLTUxMicsXG5cdFx0XHRcdFx0c2FsdCxcblx0XHRcdFx0XHRpdGVyYXRpb25zOiB0aGlzLml0ZXJhdGlvbnMsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8qYmFzZUtleSovIGtleSxcblx0XHRcdFx0LypkZXJpdmVkS2V5QWxnb3JpdGhtKi8ge1xuXHRcdFx0XHRcdG5hbWU6ICdBRVMtR0NNJyxcblx0XHRcdFx0XHRsZW5ndGg6IDI1NlxuXHRcdFx0XHR9LFxuXHRcdFx0XHQvKmV4dHJhY3RhYmxlKi8gZmFsc2UsXG5cdFx0XHRcdC8qa2V5VXNhZ2VzKi8gWydlbmNyeXB0JywgJ2RlY3J5cHQnXVxuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHByaXZhdGVLZXk7XG5cdFx0fWZpbmFsbHl7XG5cdFx0XHQvL2NvbnNvbGUudGltZUVuZCgnQ3J5cHRvSGVscGVyMjMwNC5kZXJpdmVLZXknKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGVuY3J5cHRUb0J5dGVzKCB0ZXh0OiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcgKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG5cblx0XHRjb25zdCBzYWx0ID0gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyggbmV3IFVpbnQ4QXJyYXkodGhpcy5zYWx0U2l6ZSkgKTtcblxuXHRcdGNvbnN0IGtleSA9IGF3YWl0IHRoaXMuZGVyaXZlS2V5KCBwYXNzd29yZCwgc2FsdCApO1xuXHRcdFxuXHRcdGNvbnN0IHV0ZjhFbmNvZGVyXHQ9IG5ldyBUZXh0RW5jb2RlcigpO1xuXHRcdGNvbnN0IHRleHRCeXRlc1RvRW5jcnlwdCA9IHV0ZjhFbmNvZGVyLmVuY29kZSh0ZXh0KTtcblx0XHRjb25zdCB2ZWN0b3IgPSBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKG5ldyBVaW50OEFycmF5KHRoaXMudmVjdG9yU2l6ZSkpO1xuXHRcdFxuXHRcdC8vIGVuY3J5cHQgaW50byBieXRlc1xuXHRcdGNvbnN0IGVuY3J5cHRlZEJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoXG5cdFx0XHRhd2FpdCBjcnlwdG8uc3VidGxlLmVuY3J5cHQoXG5cdFx0XHRcdC8qYWxnb3JpdGhtKi8ge1xuXHRcdFx0XHRcdG5hbWU6ICdBRVMtR0NNJyxcblx0XHRcdFx0XHRpdjogdmVjdG9yXG5cdFx0XHRcdH0sXG5cdFx0XHRcdC8qa2V5Ki8ga2V5LFxuXHRcdFx0XHQvKmRhdGEqLyB0ZXh0Qnl0ZXNUb0VuY3J5cHRcblx0XHRcdClcblx0XHQpO1xuXHRcdFxuXHRcdGNvbnN0IGZpbmFsQnl0ZXMgPSBuZXcgVWludDhBcnJheSggdmVjdG9yLmJ5dGVMZW5ndGggKyBzYWx0LmJ5dGVMZW5ndGggKyBlbmNyeXB0ZWRCeXRlcy5ieXRlTGVuZ3RoICk7XG5cdFx0ZmluYWxCeXRlcy5zZXQoIHZlY3RvciwgMCApO1xuXHRcdGZpbmFsQnl0ZXMuc2V0KCBzYWx0LCB2ZWN0b3IuYnl0ZUxlbmd0aCApO1xuXHRcdGZpbmFsQnl0ZXMuc2V0KCBlbmNyeXB0ZWRCeXRlcywgdmVjdG9yLmJ5dGVMZW5ndGggKyBzYWx0LmJ5dGVMZW5ndGggKTtcblxuXHRcdHJldHVybiBmaW5hbEJ5dGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBjb252ZXJ0VG9TdHJpbmcoIGJ5dGVzIDogVWludDhBcnJheSApOiBzdHJpbmcge1xuXHRcdGxldCByZXN1bHQgPSAnJztcblx0XHRmb3IgKGxldCBpZHggPSAwOyBpZHggPCBieXRlcy5sZW5ndGg7IGlkeCsrKSB7XG5cdFx0XHQvLyBhcHBlbmQgdG8gcmVzdWx0XG5cdFx0XHRyZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpZHhdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBlbmNyeXB0VG9CYXNlNjQodGV4dDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblxuXHRcdGNvbnN0IGZpbmFsQnl0ZXMgPSBhd2FpdCB0aGlzLmVuY3J5cHRUb0J5dGVzKHRleHQsIHBhc3N3b3JkKTtcblxuXHRcdC8vY29udmVydCBhcnJheSB0byBiYXNlNjRcblx0XHRjb25zdCBiYXNlNjRUZXh0ID0gYnRvYSggdGhpcy5jb252ZXJ0VG9TdHJpbmcoZmluYWxCeXRlcykgKTtcblxuXHRcdHJldHVybiBiYXNlNjRUZXh0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdHJpbmdUb0FycmF5KHN0cjogc3RyaW5nKTogVWludDhBcnJheSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcblx0XHRcdHJlc3VsdC5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHJlc3VsdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRlY3J5cHRGcm9tQnl0ZXMoXG5cdFx0ZW5jcnlwdGVkQnl0ZXM6IFVpbnQ4QXJyYXksXG5cdFx0cGFzc3dvcmQ6IHN0cmluZ1xuXHQpOiBQcm9taXNlPHN0cmluZ3xudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdFxuXHRcdFx0bGV0IG9mZnNldDogbnVtYmVyO1xuXHRcdFx0bGV0IG5leHRPZmZzZXQgOiBudW1iZXJ8dW5kZWZpbmVkO1xuXHRcdFx0XG5cdFx0XHQvLyBleHRyYWN0IGl2XG5cdFx0XHRvZmZzZXQgPSAwO1xuXHRcdFx0bmV4dE9mZnNldCA9IG9mZnNldCArIHRoaXMudmVjdG9yU2l6ZTtcblx0XHRcdGNvbnN0IHZlY3RvciA9IGVuY3J5cHRlZEJ5dGVzLnNsaWNlKG9mZnNldCwgbmV4dE9mZnNldCk7XG5cdFx0XHRcblx0XHRcdC8vIGV4dHJhY3Qgc2FsdFxuXHRcdFx0b2Zmc2V0ID0gbmV4dE9mZnNldDtcblx0XHRcdG5leHRPZmZzZXQgPSBvZmZzZXQgKyB0aGlzLnNhbHRTaXplO1xuXHRcdFx0Y29uc3Qgc2FsdCA9IGVuY3J5cHRlZEJ5dGVzLnNsaWNlKG9mZnNldCwgbmV4dE9mZnNldCk7XG5cdFx0XHRcblx0XHRcdC8vIGV4dHJhY3QgZW5jcnlwdGVkIHRleHRcblx0XHRcdG9mZnNldCA9IG5leHRPZmZzZXQ7XG5cdFx0XHRuZXh0T2Zmc2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgZW5jcnlwdGVkVGV4dEJ5dGVzID0gZW5jcnlwdGVkQnl0ZXMuc2xpY2Uob2Zmc2V0KTtcblx0XHRcdFxuXHRcdFx0Y29uc3Qga2V5ID0gYXdhaXQgdGhpcy5kZXJpdmVLZXkocGFzc3dvcmQsIHNhbHQpO1xuXHRcdFx0XG5cdFx0XHQvLyBkZWNyeXB0IGludG8gYnl0ZXNcblx0XHRcdGNvbnN0IGRlY3J5cHRlZEJ5dGVzID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5kZWNyeXB0KFxuXHRcdFx0XHQvKmFsZ29yaXRobSovIHtcblx0XHRcdFx0XHRuYW1lOiAnQUVTLUdDTScsXG5cdFx0XHRcdFx0aXY6IHZlY3RvclxuXHRcdFx0XHR9LFxuXHRcdFx0XHQvKmtleSovIGtleSxcblx0XHRcdFx0LypkYXRhKi8gZW5jcnlwdGVkVGV4dEJ5dGVzXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHQvLyBjb252ZXJ0IGJ5dGVzIHRvIHRleHRcblx0XHRcdGNvbnN0IHV0ZjhEZWNvZGVyXHQ9IG5ldyBUZXh0RGVjb2RlcigpO1xuXHRcdFx0Y29uc3QgZGVjcnlwdGVkVGV4dCA9IHV0ZjhEZWNvZGVyLmRlY29kZShkZWNyeXB0ZWRCeXRlcyk7XG5cdFx0XHRyZXR1cm4gZGVjcnlwdGVkVGV4dDtcblx0XHRcdFxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vY29uc29sZS5lcnJvcihlKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyBkZWNyeXB0RnJvbUJhc2U2NCggYmFzZTY0RW5jb2RlZDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nICk6IFByb21pc2U8c3RyaW5nfG51bGw+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYnl0ZXNUb0RlY29kZSA9IHRoaXMuc3RyaW5nVG9BcnJheShhdG9iKGJhc2U2NEVuY29kZWQpKTtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRlY3J5cHRGcm9tQnl0ZXMoIGJ5dGVzVG9EZWNvZGUsIHBhc3N3b3JkICk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cbn0iLCAiaW1wb3J0IHsgRmlsZURhdGEgfSBmcm9tIFwiLi9GaWxlRGF0YUhlbHBlci50c1wiO1xuaW1wb3J0IHsgRGVjcnlwdGFibGUgfSBmcm9tIFwiLi4vZmVhdHVyZXMvZmVhdHVyZS1pbnBsYWNlLWVuY3J5cHQvRGVjcnlwdGFibGUudHNcIjtcbmltcG9ydCB7IElDcnlwdG9IZWxwZXIgfSBmcm9tIFwiLi9JQ3J5cHRvSGVscGVyLnRzXCI7XG5pbXBvcnQgeyBDcnlwdG9IZWxwZXIyMzA0IH0gZnJvbSBcIi4vQ3J5cHRvSGVscGVyMjMwNC50c1wiO1xuXG5leHBvcnQgY2xhc3MgQ3J5cHRvSGVscGVyRmFjdG9yeXtcblxuXHRwdWJsaWMgc3RhdGljIGNyeXB0b0hlbHBlcjIzMDRfdjIgPSBuZXcgQ3J5cHRvSGVscGVyMjMwNCggMTYsIDE2LCAyMTAwMDAgKTtcblxuXHRwdWJsaWMgc3RhdGljIEJ1aWxkRGVmYXVsdCgpOiBJQ3J5cHRvSGVscGVye1xuXHRcdHJldHVybiB0aGlzLmNyeXB0b0hlbHBlcjIzMDRfdjI7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIEJ1aWxkRnJvbUZpbGVEYXRhT3JUaHJvdyggZGF0YTogRmlsZURhdGEgKSA6IElDcnlwdG9IZWxwZXIge1xuXHRcdGNvbnN0IHJlc3VsdCA9IENyeXB0b0hlbHBlckZhY3RvcnkuQnVpbGRGcm9tRmlsZURhdGFPck51bGwoZGF0YSk7XG5cdFx0aWYgKCByZXN1bHQgIT0gbnVsbCApe1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKCBgVW5hYmxlIHRvIGRldGVybWluZSBJQ3J5cHRvSGVscGVyIGZvciBGaWxlIHZlciAke2RhdGEudmVyc2lvbn1gKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgQnVpbGRGcm9tRmlsZURhdGFPck51bGwoIGRhdGE6IEZpbGVEYXRhICkgOiBJQ3J5cHRvSGVscGVyIHwgbnVsbCB7XG5cdFx0c3dpdGNoICggZGF0YS52ZXJzaW9uICl7XG5cdFx0XHRjYXNlICcyLjAnOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jcnlwdG9IZWxwZXIyMzA0X3YyO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHN0YXRpYyBCdWlsZEZyb21EZWNyeXB0YWJsZU9yVGhyb3coIGRlY3J5cHRhYmxlOiBEZWNyeXB0YWJsZSApIDogSUNyeXB0b0hlbHBlciB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gQ3J5cHRvSGVscGVyRmFjdG9yeS5CdWlsZEZyb21EZWNyeXB0YWJsZU9yTnVsbCggZGVjcnlwdGFibGUgKTtcblxuXHRcdGlmIChyZXN1bHQgIT0gbnVsbCl7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoIGBVbmFibGUgdG8gZGV0ZXJtaW5lIElDcnlwdG9IZWxwZXIgZm9yIERlY3J5cHRhYmxlIHZlciAke2RlY3J5cHRhYmxlLnZlcnNpb259YCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIEJ1aWxkRnJvbURlY3J5cHRhYmxlT3JOdWxsKCBkZWNyeXB0YWJsZTogRGVjcnlwdGFibGUgKSA6IElDcnlwdG9IZWxwZXIgfCBudWxsIHtcblx0XHRzd2l0Y2ggKCBkZWNyeXB0YWJsZS52ZXJzaW9uICl7XG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHJldHVybiB0aGlzLmNyeXB0b0hlbHBlcjIzMDRfdjI7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxufVxuIiwgImltcG9ydCB7IENyeXB0b0hlbHBlckZhY3RvcnkgfSBmcm9tIFwiLi9DcnlwdG9IZWxwZXJGYWN0b3J5LnRzXCI7XG5cbmV4cG9ydCBjbGFzcyBGaWxlRGF0YSB7XG5cdFxuXHRwdWJsaWMgdmVyc2lvbiA9ICcyLjAnO1xuXHRwdWJsaWMgaGludDogc3RyaW5nO1xuXHRwdWJsaWMgZW5jb2RlZERhdGE6c3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKCB2ZXJzaW9uOnN0cmluZywgaGludDpzdHJpbmcsIGVuY29kZWREYXRhOnN0cmluZyApe1xuXHRcdHRoaXMudmVyc2lvbiA9IHZlcnNpb247XG5cdFx0dGhpcy5oaW50ID0gaGludDtcblx0XHR0aGlzLmVuY29kZWREYXRhID0gZW5jb2RlZERhdGE7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVEYXRhSGVscGVye1xuXG5cdHB1YmxpYyBzdGF0aWMgREVGQVVMVF9WRVJTSU9OID0gJzIuMCc7XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyBlbmNyeXB0KCBwYXNzOiBzdHJpbmcsIGhpbnQ6c3RyaW5nLCB0ZXh0OnN0cmluZyApIDogUHJvbWlzZTxGaWxlRGF0YT57XG5cdFx0Y29uc3QgY3J5cHRvID0gQ3J5cHRvSGVscGVyRmFjdG9yeS5CdWlsZERlZmF1bHQoKTtcblx0XHRjb25zdCBlbmNyeXB0ZWREYXRhID0gYXdhaXQgY3J5cHRvLmVuY3J5cHRUb0Jhc2U2NCh0ZXh0LCBwYXNzKTtcblx0XHRyZXR1cm4gbmV3IEZpbGVEYXRhKCBGaWxlRGF0YUhlbHBlci5ERUZBVUxUX1ZFUlNJT04sIGhpbnQsIGVuY3J5cHRlZERhdGEpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyBkZWNyeXB0KCBkYXRhOiBGaWxlRGF0YSwgcGFzczpzdHJpbmcgKSA6IFByb21pc2U8c3RyaW5nfG51bGw+e1xuXHRcdGlmICggZGF0YS5lbmNvZGVkRGF0YSA9PSAnJyApe1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRjb25zdCBjcnlwdG8gPSBDcnlwdG9IZWxwZXJGYWN0b3J5LkJ1aWxkRnJvbUZpbGVEYXRhT3JUaHJvdyggZGF0YSApO1xuXHRcdHJldHVybiBhd2FpdCBjcnlwdG8uZGVjcnlwdEZyb21CYXNlNjQoIGRhdGEuZW5jb2RlZERhdGEsIHBhc3MgKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSnNvbkZpbGVFbmNvZGluZyB7XG5cblx0cHVibGljIHN0YXRpYyBlbmNvZGUoIGRhdGE6IEZpbGVEYXRhICkgOiBzdHJpbmd7XG5cdFx0Ly9jb25zb2xlLmRlYnVnKCAnSnNvbkZpbGVFbmNvZGluZy5lbmNvZGUnLCB7ZGF0YX0gKTtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMik7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGlzRW5jb2RlZCggdGV4dDogc3RyaW5nICkgOiBib29sZWFuIHtcblx0XHR0cnkge1xuXHRcdFx0SlNPTi5wYXJzZSggdGV4dCApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZGVjb2RlKCBlbmNvZGVkVGV4dDpzdHJpbmcgKSA6IEZpbGVEYXRhIHtcblx0XHQvL2NvbnNvbGUuZGVidWcoJ0pzb25GaWxlRW5jb2RpbmcuZGVjb2RlJyx7ZW5jb2RlZFRleHR9KTtcblx0XHRpZiAoIGVuY29kZWRUZXh0ID09PSAnJyApe1xuXHRcdFx0cmV0dXJuIG5ldyBGaWxlRGF0YSggRmlsZURhdGFIZWxwZXIuREVGQVVMVF9WRVJTSU9OLCAnJywgJycgKTtcblx0XHR9XG5cdFx0cmV0dXJuIEpTT04ucGFyc2UoIGVuY29kZWRUZXh0ICkgYXMgRmlsZURhdGE7XG5cdH1cbn1cbiIsICJpbXBvcnQgeyBGZWF0dXJlSW5wbGFjZVRleHRBbmFseXNpcyB9IGZyb20gXCIuLi9mZWF0dXJlcy9mZWF0dXJlLWlucGxhY2UtZW5jcnlwdC9mZWF0dXJlSW5wbGFjZVRleHRBbmFseXNpcy50c1wiO1xuaW1wb3J0IHsgQ3J5cHRvSGVscGVyRmFjdG9yeSB9IGZyb20gXCIuLi9zZXJ2aWNlcy9DcnlwdG9IZWxwZXJGYWN0b3J5LnRzXCI7XG5pbXBvcnQgeyBKc29uRmlsZUVuY29kaW5nIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0ZpbGVEYXRhSGVscGVyLnRzXCI7XG5cbmV4cG9ydCBjbGFzcyBPZmZsaW5lRGVjcnlwdCB7XG5cblx0cHVibGljIGFzeW5jIGRlY3J5cHQoIGNvbnRlbnQ6c3RyaW5nLCBwYXNzd29yZDogc3RyaW5nICkgOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblxuXHRcdC8vIFRyeWluZyB0aGUgZGVmYXVsdCBkZWNyeXB0aW9uXG5cdFx0Y29uc29sZS5pbmZvKCAnVHJ5aW5nIHRoZSBkZWZhdWx0IGRlY3J5cHRpb24nICk7XG5cdFx0Y29uc3QgY2hEZWYgPSBDcnlwdG9IZWxwZXJGYWN0b3J5LkJ1aWxkRGVmYXVsdCgpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoRGVmLmRlY3J5cHRGcm9tQmFzZTY0KCBjb250ZW50LCBwYXNzd29yZCApO1xuXHRcdGlmICggcmVzdWx0ICE9IG51bGwgKXtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5aW5nIG1hcmtlZCBpbnBsYWNlIGZlYXR1cmUgZGVjcnlwdGlvblxuXHRcdGNvbnNvbGUuaW5mbyggJ1RyeWluZyBtYXJrZWQgaW5wbGFjZSBmZWF0dXJlIGRlY3J5cHRpb24nICk7XG5cdFx0Y29uc3QgdGEgPSBuZXcgRmVhdHVyZUlucGxhY2VUZXh0QW5hbHlzaXMoIGNvbnRlbnQgKTtcblx0XHRpZiAoIHRhLmRlY3J5cHRhYmxlICE9IG51bGwgKXtcblx0XHRcdGNvbnN0IGNoID0gQ3J5cHRvSGVscGVyRmFjdG9yeS5CdWlsZEZyb21EZWNyeXB0YWJsZU9yTnVsbCh0YS5kZWNyeXB0YWJsZSk7XG5cdFx0XHRpZiAoY2ggIT0gbnVsbCl7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNoLmRlY3J5cHRGcm9tQmFzZTY0KCB0YS5kZWNyeXB0YWJsZS5iYXNlNjRDaXBoZXJUZXh0LCBwYXNzd29yZCApO1xuXHRcdFx0XHRpZiAoIHJlc3VsdCAhPSBudWxsICl7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRyeWluZyB3aG9sZSBub3RlIGZlYXR1cmUgZGVjcnlwdGlvblxuXHRcdGNvbnNvbGUuaW5mbyggJ1RyeWluZyB3aG9sZSBub3RlIGZlYXR1cmUgZGVjcnlwdGlvbicgKTtcblx0XHR0cnl7XG5cdFx0XHRjb25zdCBmaWxlRGF0YSA9IEpzb25GaWxlRW5jb2RpbmcuZGVjb2RlKCBjb250ZW50ICk7XG5cdFx0XHRjb25zb2xlLmRlYnVnKGZpbGVEYXRhKTtcblx0XHRcdGNvbnN0IGNoRmQgPSBDcnlwdG9IZWxwZXJGYWN0b3J5LkJ1aWxkRnJvbUZpbGVEYXRhT3JOdWxsKCBmaWxlRGF0YSApO1xuXHRcdFx0Y29uc3QgcmVzdWx0RmQgPSBhd2FpdCBjaEZkPy5kZWNyeXB0RnJvbUJhc2U2NCggZmlsZURhdGEuZW5jb2RlZERhdGEsIHBhc3N3b3JkICk7XG5cdFx0XHRpZiAoIHJlc3VsdEZkICE9IG51bGwgKXtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdEZkO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpe1xuXHRcdFx0Y29uc29sZS5pbmZvKGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5kZWNsYXJlIGdsb2JhbCB7XG4gICAgaW50ZXJmYWNlIFdpbmRvdyB7ICQ6IE9mZmxpbmVEZWNyeXB0OyB9XG59XG5cbndpbmRvdy4kID0gbmV3IE9mZmxpbmVEZWNyeXB0KCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOztBQUFPLE1BQU0sY0FBTixNQUFpQjtBQUFBLEVBS3hCOzs7QUNKTyxNQUFNLGlCQUFpQjtBQUN2QixNQUFNLHdCQUF3QjtBQUM5QixNQUFNLHFCQUFxQjtBQUUzQixNQUFNLGFBQWEsS0FBSyxjQUFjLEtBQUsscUJBQXFCO0FBQ2hFLE1BQU0scUJBQXFCLEdBQUcsY0FBYyxLQUFLLHFCQUFxQjtBQVF0RSxNQUFNLGtCQUE2QztBQUFBLElBQ3pEO0FBQUEsTUFDQyxTQUFTO0FBQUEsTUFDVCxjQUFjO0FBQUEsTUFDZCxlQUFlO0FBQUEsSUFDaEI7QUFBQSxFQUNEO0FBRU8sTUFBTSx5QkFBeUI7QUFDL0IsTUFBTSxpQ0FBaUM7QUFHdkMsTUFBTSxZQUFZLGdCQUFnQixPQUFRLENBQUMsVUFBVSxXQUFXO0FBQ3RFLGFBQVMsS0FBSyxPQUFPLGNBQWMsT0FBTyxhQUFhO0FBQ3ZELFdBQU87QUFBQSxFQUNSLEdBQUcsQ0FBQyxDQUFjO0FBRVgsTUFBTSxvQkFBb0IsZ0JBQWdCLElBQUssWUFBVSxPQUFPLGFBQWM7QUFFOUUsTUFBTSx1QkFBdUI7QUFDN0IsTUFBTSxxQkFBcUI7QUFHM0IsTUFBTSxZQUFZO0FBQUEsSUFDeEI7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUVPLE1BQU0sUUFBUTs7O0FDdkNkLE1BQU0sNkJBQU4sTUFBZ0M7QUFBQSxJQWN0QyxZQUFZLE1BQWE7QUFDeEIsV0FBSyxRQUFRLElBQUk7QUFBQSxJQUNsQjtBQUFBLElBRVEsUUFBUyxNQUFxQjtBQXJCdkM7QUF1QkUsV0FBSyxnQkFBZ0I7QUFFckIsV0FBSyxVQUFVLEtBQUssV0FBVztBQUUvQixXQUFLLFVBQVMsZUFBVSxLQUFNLENBQUMsV0FBVyxLQUFLLFdBQVcsTUFBTSxDQUFFLE1BQXBELFlBQXlEO0FBQ3ZFLFdBQUssVUFBUyxlQUFVLEtBQU0sQ0FBQyxXQUFXLEtBQUssU0FBUyxNQUFNLENBQUUsTUFBbEQsWUFBdUQ7QUFFckUsV0FBSyxxQkFBcUIsS0FBSyxPQUFPLFNBQVM7QUFDL0MsV0FBSyxxQkFBcUIsS0FBSyxPQUFPLFNBQVM7QUFFL0MsV0FBSywyQkFBMkIsQ0FBQyxHQUFHLFdBQVcsR0FBRyxTQUFTLEVBQUUsS0FBTSxDQUFDLFdBQVcsS0FBSyxTQUFTLE1BQU8sQ0FBQztBQUVyRyxXQUFLLGFBQWEsS0FBSyxzQkFBc0IsS0FBSztBQUNsRCxXQUFLLGFBQWEsQ0FBQyxLQUFLLHNCQUFzQixDQUFDLEtBQUs7QUFFcEQsVUFBSSxLQUFLLFlBQVc7QUFDbkIsY0FBTSxjQUFjLEtBQUssd0JBQXdCLElBQUk7QUFFckQsWUFBSyxlQUFlLE1BQU07QUFDekIsZUFBSyxjQUFjO0FBQUEsUUFDcEIsT0FBSztBQUNKLGVBQUssYUFBYTtBQUFBLFFBQ25CO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxJQUVRLG1CQUFtQixRQUErQztBQWpEM0U7QUFrREUsY0FBTyxxQkFBZ0IsS0FBTSxDQUFDLFdBQzdCLE9BQU8saUJBQWlCLFVBQ3JCLE9BQU8sa0JBQWtCLE1BQzNCLE1BSEssWUFHQTtBQUFBLElBQ1I7QUFBQSxJQUVRLHdCQUF3QixNQUFtQztBQUNsRSxZQUFNLFNBQVMsSUFBSSxZQUFZO0FBRS9CLFVBQ0MsQ0FBQyxLQUFLLHNCQUNILENBQUMsS0FBSyxvQkFDVDtBQUNBLGVBQU87QUFBQSxNQUNSO0FBRUEsWUFBTSxTQUFTLEtBQUssbUJBQW1CLEtBQUssTUFBTTtBQUNsRCxVQUFLLFVBQVUsTUFBTTtBQUNwQixlQUFPO0FBQUEsTUFDUjtBQUNBLGFBQU8sVUFBVSxPQUFPO0FBR3hCLFlBQU0sVUFBVSxLQUFLLFVBQVUsS0FBSyxPQUFPLFFBQVEsS0FBSyxTQUFTLEtBQUssT0FBTyxNQUFNO0FBRW5GLFVBQUssQ0FBQyxHQUFHLFdBQVcsR0FBRyxTQUFTLEVBQUUsS0FBTSxDQUFDLFdBQVcsUUFBUSxTQUFVLE1BQU8sQ0FBQyxHQUFHO0FBRWhGLGVBQU87QUFBQSxNQUNSO0FBR0EsVUFBSSxRQUFRLFVBQVUsR0FBRSxNQUFNLE1BQU0sS0FBSyxPQUFNO0FBQzlDLGNBQU0sZ0JBQWdCLFFBQVEsUUFBUSxPQUFNLE1BQU0sTUFBTTtBQUN4RCxZQUFJLGdCQUFjLEdBQUU7QUFDbkIsaUJBQU87QUFBQSxRQUNSO0FBQ0EsZUFBTyxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQU8sYUFBYTtBQUMxRCxlQUFPLG1CQUFtQixRQUFRLFVBQVUsZ0JBQWMsTUFBTSxNQUFNO0FBQUEsTUFDdkUsT0FBSztBQUNKLGVBQU8sbUJBQW1CO0FBQUEsTUFDM0I7QUFDQSxhQUFPLG9CQUFvQixLQUFLLFdBQVcsT0FBTztBQUNsRCxhQUFPO0FBQUEsSUFFUjtBQUFBLEVBQ0Q7OztBQzdGTyxNQUFNLG1CQUFOLE1BQWdEO0FBQUEsSUFLdEQsWUFBYSxZQUFvQixVQUFrQixZQUFvQjtBQUV0RSxXQUFLLGFBQWE7QUFDbEIsV0FBSyxXQUFXO0FBQ2hCLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsSUFFQSxNQUFjLFVBQVcsVUFBaUIsTUFBc0M7QUFHL0UsWUFBTSxjQUFjLElBQUksWUFBWTtBQUNwQyxZQUFNLFNBQWEsWUFBWSxPQUFPLFFBQVE7QUFDOUMsWUFBTSxNQUFhLE1BQU0sT0FBTyxPQUFPO0FBQUE7QUFBQSxRQUMzQjtBQUFBO0FBQUEsUUFDQztBQUFBO0FBQUEsUUFDRTtBQUFBO0FBQUEsUUFDRTtBQUFBO0FBQUEsUUFDRixDQUFDLFdBQVc7QUFBQSxNQUMzQjtBQUdBLFVBQUc7QUFDRixjQUFNLGFBQWEsTUFBTSxPQUFPLE9BQU87QUFBQTtBQUFBLFVBQ3hCO0FBQUEsWUFDYixNQUFNO0FBQUEsWUFDTixNQUFNO0FBQUEsWUFDTjtBQUFBLFlBQ0EsWUFBWSxLQUFLO0FBQUEsVUFDbEI7QUFBQTtBQUFBLFVBQ1k7QUFBQTtBQUFBLFVBQ1k7QUFBQSxZQUN2QixNQUFNO0FBQUEsWUFDTixRQUFRO0FBQUEsVUFDVDtBQUFBO0FBQUEsVUFDZ0I7QUFBQTtBQUFBLFVBQ0YsQ0FBQyxXQUFXLFNBQVM7QUFBQSxRQUNwQztBQUVBLGVBQU87QUFBQSxNQUNSLFVBQUM7QUFBQSxNQUVEO0FBQUEsSUFDRDtBQUFBLElBRUEsTUFBYyxlQUFnQixNQUFjLFVBQXdDO0FBRW5GLFlBQU0sT0FBTyxPQUFPLGdCQUFpQixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUU7QUFFbkUsWUFBTSxNQUFNLE1BQU0sS0FBSyxVQUFXLFVBQVUsSUFBSztBQUVqRCxZQUFNLGNBQWMsSUFBSSxZQUFZO0FBQ3BDLFlBQU0scUJBQXFCLFlBQVksT0FBTyxJQUFJO0FBQ2xELFlBQU0sU0FBUyxPQUFPLGdCQUFnQixJQUFJLFdBQVcsS0FBSyxVQUFVLENBQUM7QUFHckUsWUFBTSxpQkFBaUIsSUFBSTtBQUFBLFFBQzFCLE1BQU0sT0FBTyxPQUFPO0FBQUE7QUFBQSxVQUNMO0FBQUEsWUFDYixNQUFNO0FBQUEsWUFDTixJQUFJO0FBQUEsVUFDTDtBQUFBO0FBQUEsVUFDUTtBQUFBO0FBQUEsVUFDQztBQUFBLFFBQ1Y7QUFBQSxNQUNEO0FBRUEsWUFBTSxhQUFhLElBQUksV0FBWSxPQUFPLGFBQWEsS0FBSyxhQUFhLGVBQWUsVUFBVztBQUNuRyxpQkFBVyxJQUFLLFFBQVEsQ0FBRTtBQUMxQixpQkFBVyxJQUFLLE1BQU0sT0FBTyxVQUFXO0FBQ3hDLGlCQUFXLElBQUssZ0JBQWdCLE9BQU8sYUFBYSxLQUFLLFVBQVc7QUFFcEUsYUFBTztBQUFBLElBQ1I7QUFBQSxJQUVRLGdCQUFpQixPQUE2QjtBQUNyRCxVQUFJLFNBQVM7QUFDYixlQUFTLE1BQU0sR0FBRyxNQUFNLE1BQU0sUUFBUSxPQUFPO0FBRTVDLGtCQUFVLE9BQU8sYUFBYSxNQUFNLEdBQUcsQ0FBQztBQUFBLE1BQ3pDO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFBQSxJQUVBLE1BQWEsZ0JBQWdCLE1BQWMsVUFBbUM7QUFFN0UsWUFBTSxhQUFhLE1BQU0sS0FBSyxlQUFlLE1BQU0sUUFBUTtBQUczRCxZQUFNLGFBQWEsS0FBTSxLQUFLLGdCQUFnQixVQUFVLENBQUU7QUFFMUQsYUFBTztBQUFBLElBQ1I7QUFBQSxJQUVRLGNBQWMsS0FBeUI7QUFDOUMsWUFBTSxTQUFTLENBQUM7QUFDaEIsZUFBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSztBQUNwQyxlQUFPLEtBQUssSUFBSSxXQUFXLENBQUMsQ0FBQztBQUFBLE1BQzlCO0FBQ0EsYUFBTyxJQUFJLFdBQVcsTUFBTTtBQUFBLElBQzdCO0FBQUEsSUFFQSxNQUFjLGlCQUNiLGdCQUNBLFVBQ3VCO0FBQ3ZCLFVBQUk7QUFFSCxZQUFJO0FBQ0osWUFBSTtBQUdKLGlCQUFTO0FBQ1QscUJBQWEsU0FBUyxLQUFLO0FBQzNCLGNBQU0sU0FBUyxlQUFlLE1BQU0sUUFBUSxVQUFVO0FBR3RELGlCQUFTO0FBQ1QscUJBQWEsU0FBUyxLQUFLO0FBQzNCLGNBQU0sT0FBTyxlQUFlLE1BQU0sUUFBUSxVQUFVO0FBR3BELGlCQUFTO0FBQ1QscUJBQWE7QUFDYixjQUFNLHFCQUFxQixlQUFlLE1BQU0sTUFBTTtBQUV0RCxjQUFNLE1BQU0sTUFBTSxLQUFLLFVBQVUsVUFBVSxJQUFJO0FBRy9DLGNBQU0saUJBQWlCLE1BQU0sT0FBTyxPQUFPO0FBQUE7QUFBQSxVQUM1QjtBQUFBLFlBQ2IsTUFBTTtBQUFBLFlBQ04sSUFBSTtBQUFBLFVBQ0w7QUFBQTtBQUFBLFVBQ1E7QUFBQTtBQUFBLFVBQ0M7QUFBQSxRQUNWO0FBR0EsY0FBTSxjQUFjLElBQUksWUFBWTtBQUNwQyxjQUFNLGdCQUFnQixZQUFZLE9BQU8sY0FBYztBQUN2RCxlQUFPO0FBQUEsTUFFUixTQUFTLEdBQUc7QUFFWCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFBQSxJQUVBLE1BQWEsa0JBQW1CLGVBQXVCLFVBQXlDO0FBQy9GLFVBQUk7QUFDSCxjQUFNLGdCQUFnQixLQUFLLGNBQWMsS0FBSyxhQUFhLENBQUM7QUFDNUQsZUFBTyxNQUFNLEtBQUssaUJBQWtCLGVBQWUsUUFBUztBQUFBLE1BQzdELFNBQVMsR0FBRztBQUNYLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUFBLEVBRUQ7OztBQy9KTyxNQUFNLHVCQUFOLE1BQU0scUJBQW1CO0FBQUEsSUFJL0IsT0FBYyxlQUE2QjtBQUMxQyxhQUFPLEtBQUs7QUFBQSxJQUNiO0FBQUEsSUFFQSxPQUFjLHlCQUEwQixNQUFpQztBQUN4RSxZQUFNLFNBQVMscUJBQW9CLHdCQUF3QixJQUFJO0FBQy9ELFVBQUssVUFBVSxNQUFNO0FBQ3BCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxJQUFJLE1BQU8sa0RBQWtELEtBQUssT0FBTyxFQUFFO0FBQUEsSUFDbEY7QUFBQSxJQUVBLE9BQWMsd0JBQXlCLE1BQXdDO0FBQzlFLGNBQVMsS0FBSyxTQUFTO0FBQUEsUUFDdEIsS0FBSztBQUNKLGlCQUFPLEtBQUs7QUFBQSxRQUNiO0FBQ0MsaUJBQU87QUFBQSxNQUNUO0FBQUEsSUFDRDtBQUFBLElBRUEsT0FBYyw0QkFBNkIsYUFBMkM7QUFDckYsWUFBTSxTQUFTLHFCQUFvQiwyQkFBNEIsV0FBWTtBQUUzRSxVQUFJLFVBQVUsTUFBSztBQUNsQixlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sSUFBSSxNQUFPLHlEQUF5RCxZQUFZLE9BQU8sRUFBRTtBQUFBLElBQ2hHO0FBQUEsSUFFQSxPQUFjLDJCQUE0QixhQUFrRDtBQUMzRixjQUFTLFlBQVksU0FBUztBQUFBLFFBQzdCLEtBQUs7QUFDSixpQkFBTyxLQUFLO0FBQUEsUUFDYjtBQUNDLGlCQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0Q7QUFBQSxFQUVEO0FBekNDLEVBRlkscUJBRUUsc0JBQXNCLElBQUksaUJBQWtCLElBQUksSUFBSSxJQUFPO0FBRm5FLE1BQU0sc0JBQU47OztBQ0hBLE1BQU1BLFlBQU4sTUFBZTtBQUFBLElBTXJCLFlBQWEsU0FBZ0IsTUFBYSxhQUFvQjtBQUo5RCxXQUFPLFVBQVU7QUFLaEIsV0FBSyxVQUFVO0FBQ2YsV0FBSyxPQUFPO0FBQ1osV0FBSyxjQUFjO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBRU8sTUFBTSxrQkFBTixNQUFNLGdCQUFjO0FBQUEsSUFJMUIsYUFBb0IsUUFBUyxNQUFjLE1BQWEsTUFBaUM7QUFDeEYsWUFBTUMsVUFBUyxvQkFBb0IsYUFBYTtBQUNoRCxZQUFNLGdCQUFnQixNQUFNQSxRQUFPLGdCQUFnQixNQUFNLElBQUk7QUFDN0QsYUFBTyxJQUFJRCxVQUFVLGdCQUFlLGlCQUFpQixNQUFNLGFBQWE7QUFBQSxJQUN6RTtBQUFBLElBRUEsYUFBb0IsUUFBUyxNQUFnQixNQUFvQztBQUNoRixVQUFLLEtBQUssZUFBZSxJQUFJO0FBQzVCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTUMsVUFBUyxvQkFBb0IseUJBQTBCLElBQUs7QUFDbEUsYUFBTyxNQUFNQSxRQUFPLGtCQUFtQixLQUFLLGFBQWEsSUFBSztBQUFBLElBQy9EO0FBQUEsRUFDRDtBQWZDLEVBRlksZ0JBRUUsa0JBQWtCO0FBRjFCLE1BQU0saUJBQU47QUFtQkEsTUFBTSxtQkFBTixNQUF1QjtBQUFBLElBRTdCLE9BQWMsT0FBUSxNQUF5QjtBQUU5QyxhQUFPLEtBQUssVUFBVSxNQUFNLE1BQU0sQ0FBQztBQUFBLElBQ3BDO0FBQUEsSUFFQSxPQUFjLFVBQVcsTUFBeUI7QUFDakQsVUFBSTtBQUNILGFBQUssTUFBTyxJQUFLO0FBQ2pCLGVBQU87QUFBQSxNQUNSLFNBQVUsT0FBUTtBQUNqQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFBQSxJQUVBLE9BQWMsT0FBUSxhQUFnQztBQUVyRCxVQUFLLGdCQUFnQixJQUFJO0FBQ3hCLGVBQU8sSUFBSUQsVUFBVSxlQUFlLGlCQUFpQixJQUFJLEVBQUc7QUFBQSxNQUM3RDtBQUNBLGFBQU8sS0FBSyxNQUFPLFdBQVk7QUFBQSxJQUNoQztBQUFBLEVBQ0Q7OztBQ3JETyxNQUFNLGlCQUFOLE1BQXFCO0FBQUEsSUFFM0IsTUFBYSxRQUFTLFNBQWdCLFVBQTRDO0FBR2pGLGNBQVEsS0FBTSwrQkFBZ0M7QUFDOUMsWUFBTSxRQUFRLG9CQUFvQixhQUFhO0FBQy9DLFlBQU0sU0FBUyxNQUFNLE1BQU0sa0JBQW1CLFNBQVMsUUFBUztBQUNoRSxVQUFLLFVBQVUsTUFBTTtBQUNwQixlQUFPO0FBQUEsTUFDUjtBQUdBLGNBQVEsS0FBTSwwQ0FBMkM7QUFDekQsWUFBTSxLQUFLLElBQUksMkJBQTRCLE9BQVE7QUFDbkQsVUFBSyxHQUFHLGVBQWUsTUFBTTtBQUM1QixjQUFNLEtBQUssb0JBQW9CLDJCQUEyQixHQUFHLFdBQVc7QUFDeEUsWUFBSSxNQUFNLE1BQUs7QUFDZCxnQkFBTUUsVUFBUyxNQUFNLEdBQUcsa0JBQW1CLEdBQUcsWUFBWSxrQkFBa0IsUUFBUztBQUNyRixjQUFLQSxXQUFVLE1BQU07QUFDcEIsbUJBQU9BO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBR0EsY0FBUSxLQUFNLHNDQUF1QztBQUNyRCxVQUFHO0FBQ0YsY0FBTSxXQUFXLGlCQUFpQixPQUFRLE9BQVE7QUFDbEQsZ0JBQVEsTUFBTSxRQUFRO0FBQ3RCLGNBQU0sT0FBTyxvQkFBb0Isd0JBQXlCLFFBQVM7QUFDbkUsY0FBTSxXQUFXLE9BQU0sNkJBQU0sa0JBQW1CLFNBQVMsYUFBYTtBQUN0RSxZQUFLLFlBQVksTUFBTTtBQUN0QixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNELFNBQVMsR0FBRTtBQUNWLGdCQUFRLEtBQUssQ0FBQztBQUFBLE1BQ2Y7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFLQSxTQUFPLElBQUksSUFBSSxlQUFlOyIsCiAgIm5hbWVzIjogWyJGaWxlRGF0YSIsICJjcnlwdG8iLCAicmVzdWx0Il0KfQo=
