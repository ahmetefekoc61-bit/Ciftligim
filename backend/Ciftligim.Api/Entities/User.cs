namespace Ciftligim.Api.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string PasswordHash { get; set; } = "";
    public string FullName { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}