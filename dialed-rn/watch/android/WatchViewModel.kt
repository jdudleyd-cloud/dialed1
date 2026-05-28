// WatchViewModel — receives HolePayload from RN phone via Data Layer API
// and sends ShotResult / HoleComplete messages back.

package com.dialed.watch

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.time.Instant

// ─── Data models (mirror types/models.ts) ─────────────────────────────────────

data class HolePayload(
    val holeNumber: Int,
    val courseName: String,
    val distanceFt: Int,
    val parNumber: Int,
    val windCondition: String,
    val windRelation: String,
    val windSpeedMph: Int,
    val playerScoreVsPar: Int,
    // suggestion
    val discLabel: String,
    val throwType: String,
    val expectedDistFt: Int,
    val lateralFt: Int,
    val confidence: Int,
    val topReason: String,
) {
    companion object {
        fun fromJson(json: JSONObject): HolePayload? = runCatching {
            HolePayload(
                holeNumber       = json.getInt("holeNumber"),
                courseName       = json.getString("courseName"),
                distanceFt       = json.getInt("distanceFt"),
                parNumber        = json.getInt("parNumber"),
                windCondition    = json.getString("windCondition"),
                windRelation     = json.optString("windRelation", ""),
                windSpeedMph     = json.getInt("windSpeedMph"),
                playerScoreVsPar = json.getInt("playerScoreVsPar"),
                discLabel        = json.getString("suggDiscLabel"),
                throwType        = json.getString("suggThrowType"),
                expectedDistFt   = json.getInt("suggExpectedDist"),
                lateralFt        = json.getInt("suggLateral"),
                confidence       = json.getInt("suggConfidence"),
                topReason        = json.getString("suggTopReason"),
            )
        }.getOrNull()
    }
}

// ─── ViewModel ────────────────────────────────────────────────────────────────

class WatchViewModel(app: Application) : AndroidViewModel(app), MessageClient.OnMessageReceivedListener {

    private val messageClient = Wearable.getMessageClient(app)
    private val channelClient = Wearable.getChannelClient(app)

    private val _currentPayload = MutableStateFlow<HolePayload?>(null)
    val currentPayload: StateFlow<HolePayload?> = _currentPayload

    init {
        messageClient.addListener(this)
    }

    // ─── Receive from phone ───────────────────────────────────────────────────

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != "/hole_payload") return
        val json = runCatching { JSONObject(String(event.data)) }.getOrNull() ?: return
        val payload = HolePayload.fromJson(json) ?: return
        _currentPayload.value = payload
    }

    // ─── Send to phone ────────────────────────────────────────────────────────

    fun sendShotResult(throwType: String, measuredDistFt: Int) {
        val payload = _currentPayload.value ?: return
        viewModelScope.launch {
            val json = JSONObject().apply {
                put("type",               "SHOT_RESULT")
                put("holeNumber",         payload.holeNumber)
                put("throwType",          throwType)
                put("measuredDistanceFt", measuredDistFt)
                put("confirmedAt",        Instant.now().toString())
                put("inventoryId",        0) // TODO: wire to actual inventory ID
            }
            sendToPhone("/shot_result", json.toString().toByteArray())
        }
    }

    fun sendHoleComplete(strokes: Int) {
        val payload = _currentPayload.value ?: return
        viewModelScope.launch {
            val json = JSONObject().apply {
                put("type",        "HOLE_COMPLETE")
                put("holeNumber",  payload.holeNumber)
                put("strokes",     strokes)
                put("par",         payload.parNumber)
                put("confirmedAt", Instant.now().toString())
            }
            sendToPhone("/hole_complete", json.toString().toByteArray())
        }
    }

    private suspend fun sendToPhone(path: String, data: ByteArray) {
        try {
            val nodes = Wearable.getNodeClient(getApplication<Application>())
                .connectedNodes
                .await()
            nodes.forEach { node ->
                messageClient.sendMessage(node.id, path, data).await()
            }
        } catch (e: Exception) {
            android.util.Log.w("WatchViewModel", "sendToPhone failed: ${e.message}")
        }
    }

    override fun onCleared() {
        messageClient.removeListener(this)
        super.onCleared()
    }
}
