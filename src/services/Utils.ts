import { TFile, normalizePath } from "obsidian";

export class Utils{

	public static getFilePathWithNewExtension( file: TFile, newExtension : string ) : string {
		return normalizePath( `${file.parent?.path}/${file.basename}.${newExtension}` )
	}

	public static getFilePathExcludingExtension( file: TFile ) : string {
		return normalizePath( `${file.parent?.path}/${file.basename}` );
	}

	public static getPathExcludingExtension( path: string ) : string {
		const normalizedPath = normalizePath( path );
		const slashIndex = normalizedPath.lastIndexOf( '/' );
		const dotIndex = normalizedPath.lastIndexOf( '.' );
		if ( dotIndex <= slashIndex ){
			return normalizedPath;
		}
		return normalizedPath.slice( 0, dotIndex );
	}

}
