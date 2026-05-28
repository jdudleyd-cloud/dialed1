// Screen 2 of 3: Shot Confirm (WearOS)
// User selects throw type via picker, enters measured distance via rotary input,
// then confirms to send ShotResult to the phone.

package com.dialed.watch

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val THROW_TYPES = listOf("backhand", "forehand", "sidearm", "tomahawk")

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun ShotConfirmScreen(
    payload: HolePayload?,
    onConfirm: (throwType: String, measuredDistFt: Int) -> Unit,
) {
    var selectedType by remember { mutableStateOf(payload?.throwType ?: "backhand") }
    var distanceFt by remember { mutableIntStateOf(payload?.expectedDistFt ?: 200) }
    var confirmed by remember { mutableStateOf(false) }

    val focusRequester = remember { FocusRequester() }
    val coroutineScope = rememberCoroutineScope()

    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onRotaryScrollEvent { event ->
                val delta = (event.verticalScrollPixels / 8f).roundToInt()
                distanceFt = (distanceFt + delta * 5).coerceIn(0, 600)
                true
            }
            .focusRequester(focusRequester)
            .focusable(),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        item {
            Text(
                "SHOT CONFIRM",
                color = Color.Cyan,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // ── Throw type picker ───────────────────────────────────────────────────
        item {
            Text("THROW TYPE", color = Color.Gray, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
        }
        item {
            Picker(
                state = rememberPickerState(
                    initialNumberOfOptions = THROW_TYPES.size,
                    initiallySelectedOption = THROW_TYPES.indexOf(selectedType).coerceAtLeast(0),
                ),
                modifier = Modifier.fillMaxWidth().height(60.dp),
                contentDescription = "Throw type",
                onSelected = { idx -> selectedType = THROW_TYPES[idx] },
            ) { idx ->
                Text(
                    THROW_TYPES[idx].uppercase(),
                    color = if (THROW_TYPES[idx] == selectedType) Color.White else Color.Gray,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        // ── Distance (rotary input) ─────────────────────────────────────────────
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text("DISTANCE", color = Color.Gray, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                Text(
                    "$distanceFt ft",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
                Text("(rotate crown to adjust)", color = Color.Gray, fontSize = 8.sp)
            }
        }

        // ── Confirm ────────────────────────────────────────────────────────────
        item {
            Chip(
                onClick = {
                    if (!confirmed) {
                        confirmed = true
                        onConfirm(selectedType, distanceFt)
                    }
                },
                label = {
                    Text(
                        if (confirmed) "✓ SENT" else "CONFIRM",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ChipDefaults.chipColors(
                    backgroundColor = if (confirmed) Color.Green.copy(alpha = 0.3f) else Color.Cyan.copy(alpha = 0.2f)
                ),
                enabled = !confirmed,
            )
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }
}
