// Screen 1 of 3: Tee Pad (WearOS)
// Shows hole distance, par, wind, caddy suggestion, and confidence meter.

package com.dialed.watch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*

@Composable
fun TeePadScreen(
    payload: HolePayload?,
    onThrowTapped: () -> Unit,
) {
    if (payload == null) {
        Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
            Text("Waiting...", color = Color.Gray, fontSize = 12.sp)
        }
        return
    }

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize().background(Color.Black),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // ── Hole header ────────────────────────────────────────────────────────
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "HOLE ${payload.holeNumber}",
                    color = Color.Cyan,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    "PAR ${payload.parNumber}",
                    color = Color.Gray,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        // ── Distance ───────────────────────────────────────────────────────────
        item {
            Text(
                "${payload.distanceFt} ft",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }

        // ── Wind ───────────────────────────────────────────────────────────────
        item {
            Text(
                "${windEmoji(payload.windRelation)} ${payload.windCondition.uppercase()} · ${payload.windSpeedMph} mph",
                color = windColor(payload.windCondition),
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
            )
        }

        item { Divider(color = Color.Gray.copy(alpha = 0.3f), thickness = 0.5.dp) }

        // ── Caddy ──────────────────────────────────────────────────────────────
        item {
            Text("CADDY", color = Color.Gray, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
        }
        item {
            Text(
                payload.discLabel,
                color = Color.Yellow,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.Monospace,
            )
        }
        item {
            Text(
                payload.throwType.uppercase(),
                color = Color(0xFFFF9800),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Text(
                payload.topReason,
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 9.sp,
                maxLines = 3,
            )
        }

        // ── Confidence bar ────────────────────────────────────────────────────
        item {
            LinearProgressIndicator(
                progress = payload.confidence / 100f,
                modifier = Modifier.fillMaxWidth().height(4.dp),
                color = confidenceColor(payload.confidence),
                trackColor = Color.Gray.copy(alpha = 0.2f),
            )
        }

        // ── Lateral drift ─────────────────────────────────────────────────────
        if (Math.abs(payload.lateralFt) > 10) {
            item {
                Text(
                    lateralLabel(payload.lateralFt),
                    color = Color.White.copy(alpha = 0.55f),
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }

        // ── Score vs par ──────────────────────────────────────────────────────
        item {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                Text(
                    scoreLabel(payload.playerScoreVsPar),
                    color = scoreColor(payload.playerScoreVsPar),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }

        // ── CTA ───────────────────────────────────────────────────────────────
        item {
            Chip(
                onClick = onThrowTapped,
                label = { Text("THROW →", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                colors = ChipDefaults.chipColors(backgroundColor = Color.Cyan.copy(alpha = 0.2f)),
            )
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

private fun windEmoji(relation: String) = when (relation) {
    "headwind"    -> "↑"
    "tailwind"    -> "↓"
    "cross_left"  -> "←"
    "cross_right" -> "→"
    else          -> "~"
}

private fun windColor(condition: String) = when (condition) {
    "calm"     -> Color.Gray
    "light"    -> Color.Green
    "moderate" -> Color.Yellow
    "strong"   -> Color.Red
    else       -> Color.White
}

private fun confidenceColor(c: Int) = when {
    c >= 75 -> Color.Green
    c >= 50 -> Color.Yellow
    else    -> Color.Red
}

private fun lateralLabel(ft: Int) =
    if (ft > 0) "Drifts $ft ft right" else "Drifts ${-ft} ft left"

private fun scoreLabel(vsPar: Int) = when {
    vsPar == 0 -> "E"
    vsPar > 0  -> "+$vsPar"
    else       -> "$vsPar"
}

private fun scoreColor(vsPar: Int) = when {
    vsPar <= -2 -> Color.Yellow
    vsPar == -1 -> Color.Green
    vsPar == 0  -> Color.White
    else        -> Color.Red
}
