namespace Ciftligim.Api.Entities;

// İşletme / çiftlik. Tüm hayvanlar bir işletmeye bağlıdır.
public class Farm
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Name { get; set; } = "";
    public Guid CreatedById { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Kim hangi işletmede hangi rolde.
public class FarmMember
{
    public Guid FarmId { get; set; }
    public Guid UserId { get; set; }
    public MemberRole Role { get; set; }
    public Guid? InvitedById { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    public User User { get; set; } = null!;
}

// Sürü: işletme içindeki hayvan grubu. Çoban sürü bazında yetkilendirilir.
public class Herd
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid FarmId { get; set; }
    public string Name { get; set; } = "";
    public string? Notes { get; set; }
}

// Çobanın sorumlu olduğu sürü.
public class HerdAssignment
{
    public Guid HerdId { get; set; }
    public Guid UserId { get; set; }
    public Guid? AssignedById { get; set; }
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;

    public User User { get; set; } = null!;
}
