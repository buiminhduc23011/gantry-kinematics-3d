using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Robot.Core;
namespace Robot.Desktop;

public partial class MainWindow : Window
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };
    public MainWindow() { InitializeComponent(); Loaded += InitializeBrowser; }
    private async void InitializeBrowser(object sender, RoutedEventArgs args)
    {
        try
        {
            string site = Path.Combine(AppContext.BaseDirectory,"wwwroot");
            if (!File.Exists(Path.Combine(site,"index.html"))) throw new InvalidOperationException("Missing web assets. Run npm run build, then rebuild the desktop app.");
            var environment = await CoreWebView2Environment.CreateAsync(null,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"RodalMotionLab","WebView2"));
            await Browser.EnsureCoreWebView2Async(environment);
            Browser.CoreWebView2.SetVirtualHostNameToFolderMapping("rodal.local",site,CoreWebView2HostResourceAccessKind.DenyCors);
            Browser.CoreWebView2.NavigationStarting += (_, e) => { if (!e.Uri.StartsWith("https://rodal.local/",StringComparison.Ordinal)) e.Cancel=true; };
            Browser.CoreWebView2.NewWindowRequested += (_, e) => e.Handled=true;
            Browser.CoreWebView2.WebMessageReceived += HandleMessage;
            Browser.Source = new Uri("https://rodal.local/index.html");
        }
        catch(Exception error) { MessageBox.Show(error.Message,"Rodal could not start",MessageBoxButton.OK,MessageBoxImage.Error); }
    }
    private async void HandleMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith("https://rodal.local/",StringComparison.Ordinal)) return;
        string? id=null;
        try
        {
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            var root=message.RootElement; id=root.GetProperty("id").GetString();
            if(root.GetProperty("type").GetString()!="plan") throw new InvalidOperationException("Unknown command");
            var start=root.GetProperty("start").Deserialize<Point3>(Json);
            var end=root.GetProperty("end").Deserialize<Point3>(Json);
            double velocity=root.GetProperty("velocity").GetDouble(), acceleration=root.GetProperty("acceleration").GetDouble();
            var samples=await Task.Run(()=>MotionPlanner.Plan(start,end,velocity,acceleration));
            Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,samples},Json));
        }
        catch(Exception error) { Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,error=error.Message},Json)); }
    }
}
