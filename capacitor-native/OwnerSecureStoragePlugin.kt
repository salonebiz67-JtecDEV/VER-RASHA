package com.veyrasha.boutique.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Android Keystore-backed secure storage & device-binding plugin for VEY RASHA.
 *
 * Setup in Capacitor Android project:
 * 1. Copy this file into android/app/src/main/java/com/veyrasha/boutique/security/
 * 2. Register OwnerSecureStoragePlugin::class.java inside MainActivity.onCreate().
 * 3. Token material is encrypted using an Android Keystore AES-256-GCM master key
 *    and requests are signed using a hardware-backed Keystore ECDSA P-256 keypair.
 */
@CapacitorPlugin(name = "OwnerSecureStorage")
class OwnerSecureStoragePlugin : Plugin() {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val AES_KEY_ALIAS = "vey_rasha_owner_aes_v1"
        private const val EC_KEY_ALIAS = "vey_rasha_owner_ec_v1"
        private const val PREFS_NAME = "vey_rasha_keystore_vault"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_TOKEN_CIPHERTEXT = "owner_token_enc"
        private const val KEY_TOKEN_IV = "owner_token_iv"
    }

    private fun getOrCreateAesKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getKey(AES_KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                AES_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private fun ensureDeviceEcKeyPair(): ECPublicKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val cert = keyStore.getCertificate(EC_KEY_ALIAS)
        if (cert?.publicKey is ECPublicKey) {
            return cert.publicKey as ECPublicKey
        }

        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        kpg.initialize(
            KeyGenParameterSpec.Builder(
                EC_KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        val kp = kpg.generateKeyPair()
        return kp.public as ECPublicKey
    }

    private fun toFixed32Unsigned(value: BigInteger): ByteArray {
        val raw = value.toByteArray()
        val out = ByteArray(32)
        if (raw.size >= 32) {
            System.arraycopy(raw, raw.size - 32, out, 0, 32)
        } else {
            System.arraycopy(raw, 0, out, 32 - raw.size, raw.size)
        }
        return out
    }

    private fun encodeB64Url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

    @PluginMethod
    fun getOrCreateDeviceIdentity(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var deviceId = prefs.getString(KEY_DEVICE_ID, null)
            if (deviceId.isNullOrBlank()) {
                deviceId = UUID.randomUUID().toString()
                prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
            }

            val pub = ensureDeviceEcKeyPair()
            val jwk = JSONObject().apply {
                put("kty", "EC")
                put("crv", "P-256")
                put("x", encodeB64Url(toFixed32Unsigned(pub.w.affineX)))
                put("y", encodeB64Url(toFixed32Unsigned(pub.w.affineY)))
            }

            val ret = JSObject().apply {
                put("deviceId", deviceId)
                put("publicKeyJwk", JSObject.fromJSONObject(jwk))
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Unable to initialize Android Keystore identity", e)
        }
    }

    @PluginMethod
    fun saveDeviceToken(call: PluginCall) {
        val token = call.getString("token")?.trim()
        if (token.isNullOrEmpty()) {
            call.reject("Token is required")
            return
        }
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateAesKey())
            val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_TOKEN_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(KEY_TOKEN_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Unable to encrypt token with Android Keystore", e)
        }
    }

    @PluginMethod
    fun getDeviceToken(call: PluginCall) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val encB64 = prefs.getString(KEY_TOKEN_CIPHERTEXT, null)
            val ivB64 = prefs.getString(KEY_TOKEN_IV, null)
            if (encB64.isNullOrEmpty() || ivB64.isNullOrEmpty()) {
                call.resolve(JSObject().apply { put("token", JSONObject.NULL) })
                return
            }

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP))
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateAesKey(), spec)
            val plain = cipher.doFinal(Base64.decode(encB64, Base64.NO_WRAP))
            call.resolve(JSObject().apply { put("token", String(plain, Charsets.UTF_8)) })
        } catch (e: Exception) {
            call.resolve(JSObject().apply { put("token", JSONObject.NULL) })
        }
    }

    @PluginMethod
    fun clearDeviceToken(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_TOKEN_CIPHERTEXT).remove(KEY_TOKEN_IV).apply()
        call.resolve()
    }

    @PluginMethod
    fun signPayload(call: PluginCall) {
        val payload = call.getString("payload")
        if (payload.isNullOrEmpty()) {
            call.reject("Payload is required")
            return
        }
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            val entry = keyStore.getEntry(EC_KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
            val signature = Signature.getInstance("SHA256withECDSA").apply {
                initSign(entry.privateKey)
                update(payload.toByteArray(Charsets.UTF_8))
            }.sign()
            call.resolve(JSObject().apply { put("signature", encodeB64Url(signature)) })
        } catch (e: Exception) {
            call.reject("Unable to sign request with Android Keystore key", e)
        }
    }
}
