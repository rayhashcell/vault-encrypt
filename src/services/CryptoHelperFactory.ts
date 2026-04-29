import { FileData } from "./FileDataHelper.ts";
import { Decryptable } from "../features/feature-inplace-encrypt/Decryptable.ts";
import { ICryptoHelper } from "./ICryptoHelper.ts";
import { CryptoHelper2304 } from "./CryptoHelper2304.ts";

export class CryptoHelperFactory{

	public static cryptoHelper2304_v2 = new CryptoHelper2304( 16, 16, 210000 );

	public static BuildDefault(): ICryptoHelper{
		return this.cryptoHelper2304_v2;
	}

	public static BuildFromFileDataOrThrow( data: FileData ) : ICryptoHelper {
		const result = CryptoHelperFactory.BuildFromFileDataOrNull(data);
		if ( result != null ){
			return result;
		}
		throw new Error( `Unable to determine ICryptoHelper for File ver ${data.version}`);
	}

	public static BuildFromFileDataOrNull( data: FileData ) : ICryptoHelper | null {
		switch ( data.version ){
			case '2.0':
				return this.cryptoHelper2304_v2;
			default:
				return null;
		}
	}

	public static BuildFromDecryptableOrThrow( decryptable: Decryptable ) : ICryptoHelper {
		const result = CryptoHelperFactory.BuildFromDecryptableOrNull( decryptable );

		if (result != null){
			return result;
		}
		throw new Error( `Unable to determine ICryptoHelper for Decryptable ver ${decryptable.version}`);
	}

	public static BuildFromDecryptableOrNull( decryptable: Decryptable ) : ICryptoHelper | null {
		switch ( decryptable.version ){
			case 2:
				return this.cryptoHelper2304_v2;
			default:
				return null;
		}
	}

}
