namespace Ciftligim.Api.Entities;

// Veritabanında metin olarak saklanır ("Owner", "Shepherd"...), JSON'da "owner", "shepherd" olarak gider.

public enum MemberRole { Owner, Manager, Shepherd, Viewer }   // sahip / yönetici / çoban / izleyici

public enum AnimalSex { Unknown, Female, Male }               // bilinmiyor / dişi / erkek

public enum AnimalStatus { Active, Sold, Dead, Slaughtered, Lost }   // aktif / satıldı / öldü / kesildi / kayıp

public enum TreatmentType { Medication, Injection, Vaccine, Antiparasitic, Vitamin, Other }   // ilaç / iğne / aşı / parazit / vitamin / diğer

public enum AnimalLocation { Pasture, Barn, Other }   // mera / ahır / diğer

public enum OwnershipType { Owned, Shared, LeasedIn, Sharecropped, Other }   // tam mülk / hisseli / kiracı / ortakçı / diğer

public enum OperationType { Tillage, Sowing, Fertilizing, Spraying, Irrigation, Harvest, Other }   // sürüm / ekim / gübre / ilaçlama / sulama / hasat / diğer
