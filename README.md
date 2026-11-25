# Rodal / Motion Lab

Windows desktop prototype: WPF + WebView2 + Three.js, with a separate C# motion-planning library. Uses the original `Rodal 3 trục.stp` without modifying or uploading it.

## Run

Requires Windows, .NET 10 SDK, Node.js 20.19+ / 22.12+ and Microsoft Edge WebView2 Runtime.

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

First run installs npm dependencies and converts the STEP model locally with OpenCascade. Conversion can take several minutes. Generated CAD assets are about 164 MB and are not tracked in Git. Subsequent launches reuse them. To regenerate after changing the STEP file: `npm run convert`.

## Test-drive

1. Orbit with left drag, pan with right drag, zoom with the wheel. Top / 3D / Fit change the view.
2. Select a part in the viewport/list, or an entire CAD assembly in the left dropdown. Assign it to Fixed, X, X+Y or X+Y+Z. Assignments are saved locally, keyed by the STEP SHA-256; JSON export is available for backup (import is not yet implemented).
3. Use X−/X+, Y−/Y+, Z−/Z+ to jog by 1, 10 or 50 mm. Each click calculates a relative trajectory in C# and plays it. Only one jog runs at a time. Stop freezes playback at its current sample; it is **not a physical emergency stop**.
4. Enter an absolute target and velocity/acceleration limits, calculate, then Play / Pause / Step / scrub. Export the numerical samples as CSV.

**All parts start fixed. Jog for an axis is disabled until at least one part is mapped to that axis.** CAD assemblies are not necessarily kinematic groups: inspect them before assigning. Use "Phóng tới cụm đã chọn" to inspect the selected assembly. The application assumes a serial Cartesian X → Y → Z chain, with imported pose as displacement zero. The green marker starts at the assembly bounding-box center, **not a calibrated TCP**.

CAD orientation defaults to **+Y up**, inferred from common assembly base planes at CAD Y=4830 mm. This maps robot X=CAD X, robot Y=−CAD Z and robot Z=CAD Y. Change the CAD-up dropdown if needed; all six signed up axes are supported and saved locally. The same proper rotation is applied to geometry and jog displacement (not just to the camera). Axis-group identities still require confirmation; rotating the CAD does not infer robot joints.

No real robot connection, collision checking, machine travel-limit calibration, inverse dynamics, or hardware safety controls are implemented. The ±10000 mm and 120 s limits are software resource guards, **not verified machine limits**. Rendering is a tessellated approximation, not a CAD metrology tool.

## Structure

- `src/Robot.Core/MotionPlanner.cs`: replaceable C# straight-line planner with quintic time scaling; bounded scalar path velocity/acceleration, 10 ms samples and exact final endpoint. It is not a jerk-limited S-curve planner.
- `src/Robot.Desktop`: offline WPF host and JSON WebView2 bridge; planning runs on a worker task. Navigation restricted to bundled local assets.
- `web`: UI, CAD rendering, part mapping and sample playback. No duplicate JavaScript planning algorithm.
- `scripts/convert-step.cjs`: local STEP tessellation; retains part identity and assembly hierarchy, exports packed binary geometry in millimeters. Per-face material colors are simplified to per-part colors.
- `tests/Robot.Tests`: dependency-free executable assertions.

## Verify / develop

```powershell
dotnet run --project tests/Robot.Tests
node --test tests/coordinates.test.js
npm run build
dotnet build src/Robot.Desktop -c Release
npm run dev
```

Browser dev mode is intentionally **viewer-only**: jog and planning require the C# desktop host. There are no network APIs or cloud services. Web assets must be rebuilt and the desktop process restarted after UI changes.
