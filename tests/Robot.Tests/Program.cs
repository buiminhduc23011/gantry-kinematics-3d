using Robot.Core;
var trajectory = MotionPlanner.Plan(new(0,0,0), new(100,50,20), 100, 200);
if (trajectory[0].Position != new Point3(0,0,0) || trajectory[^1].Position != new Point3(100,50,20)) throw new Exception("Endpoints differ");
Console.WriteLine("PASS exact trajectory endpoints");
try { MotionPlanner.Plan(new(0,0,0),new(100,0,0),-1,200); throw new Exception("Accepted negative speed"); }
catch (ArgumentOutOfRangeException) { Console.WriteLine("PASS rejects invalid speed"); }
// Boundary rejection must happen before allocating a long trajectory.
try { MotionPlanner.Plan(new(0,0,0),new(double.NaN,0,0),100,200); throw new Exception("Accepted NaN"); }
catch (ArgumentOutOfRangeException) { Console.WriteLine("PASS rejects nonfinite coordinates"); }
foreach(var end in new[]{new Point3(200,100,50),new Point3(-100,-20,-50),new Point3(0,0,0),new Point3(.001,0,0)})
{
    var plan=MotionPlanner.Plan(new(0,0,0),end,100,200);
    if(plan[^1].Position!=end || Math.Abs(plan[^1].Velocity)>1e-8 || Math.Abs(plan[^1].Acceleration)>1e-8)throw new Exception("Endpoint/rest violation");
    if(plan.Any(s=>s.Velocity>100+1e-6 || Math.Abs(s.Acceleration)>200+1e-6))throw new Exception("Speed/acceleration limit violation");
    for(int i=1;i<plan.Count;i++)if(plan[i].Time<=plan[i-1].Time || plan[i].Time-plan[i-1].Time>.0100001)throw new Exception("Sample time violation");
}
Console.WriteLine("PASS reverse, zero/tiny moves, velocity/acceleration limits, fixed sample interval");
var jog=MotionPlanner.Plan(new(100,50,20),new(110,50,20),100,200);
if(jog[^1].Position!=new Point3(110,50,20)||jog.Any(s=>s.Position.Y!=50||s.Position.Z!=20))throw new Exception("Jog moved other axes");
Console.WriteLine("PASS relative jog preserves other axes");
