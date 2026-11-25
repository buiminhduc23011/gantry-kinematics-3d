namespace Robot.Core;

public readonly record struct Point3(double X, double Y, double Z);
public sealed record Sample(double Time, Point3 Position, double Velocity, double Acceleration);

/// <summary>Cartesian straight-line motion with a quintic time law. Units: mm, s.</summary>
public static class MotionPlanner
{
    public static IReadOnlyList<Sample> Plan(Point3 start, Point3 end, double maxVelocity, double maxAcceleration)
    {
        if (!double.IsFinite(maxVelocity) || maxVelocity <= 0 || maxVelocity > 10000 ||
            !double.IsFinite(maxAcceleration) || maxAcceleration <= 0 || maxAcceleration > 100000)
            throw new ArgumentOutOfRangeException(nameof(maxVelocity), "Velocity/acceleration must be finite and positive (max 10000 mm/s, 100000 mm/s²).");
        foreach (var coordinate in new[]{start.X,start.Y,start.Z,end.X,end.Y,end.Z})
            if (!double.IsFinite(coordinate) || Math.Abs(coordinate)>10000)
                throw new ArgumentOutOfRangeException(nameof(end), "Simulation coordinates must be within ±10000 mm.");
        double dx = end.X-start.X, dy = end.Y-start.Y, dz = end.Z-start.Z;
        double distance = Math.Sqrt(dx*dx + dy*dy + dz*dz);
        double duration = Math.Max(0.01, Math.Max(1.875*distance/maxVelocity, Math.Sqrt(5.773502692*distance/maxAcceleration)));
        if (duration > 120) throw new ArgumentOutOfRangeException(nameof(maxVelocity), "Trajectory exceeds the 120 second simulation limit.");
        int steps = (int)Math.Ceiling(duration / 0.01);
        var result = new List<Sample>(steps+1);
        for (int i=0; i<=steps; i++)
        {
            double t = Math.Min(i*0.01, duration), u=t/duration;
            double s = u*u*u*(10+u*(-15+6*u));
            double v = distance*30*u*u*(1-u)*(1-u)/duration;
            double a = distance*60*u*(1-u)*(1-2*u)/(duration*duration);
            result.Add(new(t, i==steps ? end : new(start.X+dx*s,start.Y+dy*s,start.Z+dz*s),v,a));
        }
        return result;
    }
}
