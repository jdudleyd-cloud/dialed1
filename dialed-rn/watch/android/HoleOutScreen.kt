// Screen 3 of 3: Hole Out (WearOS)
// User logs strokes via +/- buttons or rotary crown, confirms score, returns to tee.

package com.dialed.watch

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
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
import kotlin.math.roundToInt

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun HoleOutScreen(
    payload: HolePayload?,
    onConfirm: (strokes: Int) -> Unit,
) {
    var strokeCount by remember { mutableIntStateOf(payload?.parNumber ?: 3) }
    var confirmed by remember { mutableStateOf(false) }

    val focusRequester = remember { FocusRequester() }
    val par = payload?.parNumber ?: 3
    val vsPar = strokeCount - par

    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onRotaryScrollEvent { event ->
                val delta = (event.verticalScrollPixels / 8f).roundToInt()
                strokeCount = (strokeCount + delta).coerceIn(1, 12)
                true
            }
            .focusRequester(focusRequester)
            .focusable(),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Text(
                "HOLE ${payload?.holeNumber ?: "?"} OUT",
                color = Color.Cyan,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }

        // ── Stroke counter ─────────────────────────────────────────────────────
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Button(
                    onClick = { if (strokeCount > 1) strokeCount-- },
                    colors = ButtonDefaults.buttonColors(backgroundColor = Color.Red.copy(alpha = 0.3f)),
                    modifier = Modifier.size(36.dp),
                ) {
                    Text("−", fontSize = 20.sp, color = Color.White, fontWeight = FontWeight.Black)
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "$strokeCount",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White,
                    )
                    Text("STROKES", color = Color.Gray, fontSize = 8.sp, fontFamily = FontFamily.Monospace)
                }

                Button(
                    onClick = { if (strokeCount < 12) strokeCount++ },
                    colors = ButtonDefaults.buttonColors(backgroundColor = Color.Green.copy(alpha = 0.3f)),
                    modifier = Modifier.size(36.dp),
                ) {
                    Text("+", fontSize = 20.sp, color = Color.White, fontWeight = FontWeight.Black)
                }
            }
        }

        // ── Score label ────────────────────────────────────────────────────────
        item {
            Text(
                vsParLabel(vsPar),
                color = vsParColor(vsPar),
                fontSize = 15.sp,
                fontWeight = FontWeight.Heavy,
                fontFamily = FontFamily.Monospace,
            )
        }

        item { Divider(color = Color.Gray.copy(alpha = 0.3f), thickness = 0.5.dp) }

        // ── Confirm ────────────────────────────────────────────────────────────
        item {
            Chip(
                onClick = {
                    if (!confirmed) {
                        confirmed = true
                        onConfirm(strokeCount)
                    }
                },
                label = {
                    Text(
                        if (confirmed) "NEXT →" else "CONFIRM",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

private fun vsParLabel(vsPar: Int) = when {
    vsPar <= -2 -> "EAGLE 🦅"
    vsPar == -1 -> "BIRDIE 🐦"
    vsPar == 0  -> "PAR"
    vsPar == 1  -> "BOGEY"
    vsPar == 2  -> "DOUBLE"
    else        -> "+$vsPar"
}

private fun vsParColor(vsPar: Int) = when {
    vsPar <= -2 -> Color.Yellow
    vsPar == -1 -> Color.Green
    vsPar == 0  -> Color.White
    vsPar == 1  -> Color(0xFFFF9800)
    else        -> Color.Red
}
