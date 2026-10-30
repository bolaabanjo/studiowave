import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Photos from the phone, shrunk on the device to a JPEG no longer than
 * `maxSide` on its long side (cencori lib/studio/resize-photo.ts), as base64
 * for the Studio API. Null when the owner backed out.
 */
export async function pickPhotos({ max = 1, maxSide = 1600, quality = 0.85, camera = false } = {}): Promise<Array<{ data: string; mime_type: "image/jpeg"; uri: string }> | null> {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsMultipleSelection: max > 1, selectionLimit: max };
    if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Allow Studio to use the camera in your phone's Settings.");
    }
    const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets.length) return null;
    return Promise.all(picked.assets.slice(0, max).map(async (asset) => {
        const scale = Math.min(1, maxSide / Math.max(asset.width, asset.height));
        const context = ImageManipulator.manipulate(asset.uri).resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
        const image = await context.renderAsync();
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
        if (!saved.base64) throw new Error("Couldn't read that photo.");
        return { data: saved.base64, mime_type: "image/jpeg" as const, uri: saved.uri };
    }));
}
