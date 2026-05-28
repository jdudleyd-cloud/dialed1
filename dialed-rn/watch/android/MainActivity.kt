// DIALED Watch — WearOS companion app entry point
// Target: Wear OS 3.0+, Jetpack Compose for Wear
// Bridge: Wearable Data Layer API (MessageClient + DataClient)

package com.dialed.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            DialedWatchTheme {
                val navController = rememberSwipeDismissableNavController()
                val vm: WatchViewModel = viewModel()
                val payload by vm.currentPayload.collectAsState()

                DialedNavHost(navController, vm, payload)
            }
        }
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

object Routes {
    const val TEE_PAD     = "tee_pad"
    const val SHOT_CONFIRM = "shot_confirm"
    const val HOLE_OUT     = "hole_out"
}

@Composable
fun DialedNavHost(
    navController: NavHostController,
    vm: WatchViewModel,
    payload: HolePayload?,
) {
    SwipeDismissableNavHost(
        navController = navController,
        startDestination = Routes.TEE_PAD,
    ) {
        composable(Routes.TEE_PAD) {
            TeePadScreen(
                payload = payload,
                onThrowTapped = { navController.navigate(Routes.SHOT_CONFIRM) },
            )
        }
        composable(Routes.SHOT_CONFIRM) {
            ShotConfirmScreen(
                payload = payload,
                onConfirm = { throwType, distFt ->
                    vm.sendShotResult(throwType, distFt)
                    navController.navigate(Routes.HOLE_OUT)
                },
            )
        }
        composable(Routes.HOLE_OUT) {
            HoleOutScreen(
                payload = payload,
                onConfirm = { strokes ->
                    vm.sendHoleComplete(strokes)
                    navController.popBackStack(Routes.TEE_PAD, inclusive = false)
                },
            )
        }
    }
}
