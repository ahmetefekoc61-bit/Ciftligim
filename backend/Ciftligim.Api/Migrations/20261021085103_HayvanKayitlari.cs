using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ciftligim.Api.Migrations
{
    /// <inheritdoc />
    public partial class HayvanKayitlari : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "animal_location_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    animal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    since = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    recorded_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_animal_location_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_animal_location_events_animals_animal_id",
                        column: x => x.animal_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_animal_location_events_users_recorded_by_id",
                        column: x => x.recorded_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "animal_weights",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    animal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    weighed_on = table.Column<DateOnly>(type: "date", nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    recorded_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_animal_weights", x => x.id);
                    table.CheckConstraint("ck_animal_weights_positive", "weight_kg > 0");
                    table.ForeignKey(
                        name: "fk_animal_weights_animals_animal_id",
                        column: x => x.animal_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_animal_weights_users_recorded_by_id",
                        column: x => x.recorded_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "birth_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mother_id = table.Column<Guid>(type: "uuid", nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: false),
                    offspring_count = table.Column<short>(type: "smallint", nullable: false),
                    alive_count = table.Column<short>(type: "smallint", nullable: true),
                    difficulty = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    recorded_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_birth_events", x => x.id);
                    table.CheckConstraint("ck_birth_events_counts", "offspring_count >= 0 AND (alive_count IS NULL OR (alive_count >= 0 AND alive_count <= offspring_count))");
                    table.ForeignKey(
                        name: "fk_birth_events_animals_mother_id",
                        column: x => x.mother_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_birth_events_users_recorded_by_id",
                        column: x => x.recorded_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "medicines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    active_ingredient = table.Column<string>(type: "text", nullable: true),
                    default_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    meat_withdrawal_days = table.Column<int>(type: "integer", nullable: true),
                    milk_withdrawal_days = table.Column<int>(type: "integer", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_medicines", x => x.id);
                    table.CheckConstraint("ck_medicines_meat_days", "meat_withdrawal_days IS NULL OR meat_withdrawal_days >= 0");
                    table.CheckConstraint("ck_medicines_milk_days", "milk_withdrawal_days IS NULL OR milk_withdrawal_days >= 0");
                    table.ForeignKey(
                        name: "fk_medicines_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "treatments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    animal_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    medicine_id = table.Column<Guid>(type: "uuid", nullable: true),
                    medicine_text = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    dose = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    dose_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    route = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    administered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    meat_withdrawal_until = table.Column<DateOnly>(type: "date", nullable: true),
                    milk_withdrawal_until = table.Column<DateOnly>(type: "date", nullable: true),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recorded_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_treatments", x => x.id);
                    table.ForeignKey(
                        name: "fk_treatments_animals_animal_id",
                        column: x => x.animal_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_treatments_medicines_medicine_id",
                        column: x => x.medicine_id,
                        principalTable: "medicines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_treatments_users_recorded_by_id",
                        column: x => x.recorded_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "medicines",
                columns: new[] { "id", "active_ingredient", "default_unit", "farm_id", "meat_withdrawal_days", "milk_withdrawal_days", "name", "notes" },
                values: new object[,]
                {
                    { new Guid("0199a000-0000-7000-8000-000000000001"), "ivermektin", "ml", null, null, null, "Ivomec", null },
                    { new Guid("0199a000-0000-7000-8000-000000000002"), "doramektin", "ml", null, null, null, "Dectomax", null },
                    { new Guid("0199a000-0000-7000-8000-000000000003"), "albendazol", "ml", null, null, null, "Albendazol (iç parazit)", null },
                    { new Guid("0199a000-0000-7000-8000-000000000004"), "oksitetrasiklin", "ml", null, null, null, "Oksitetrasiklin (LA)", null },
                    { new Guid("0199a000-0000-7000-8000-000000000005"), "penisilin + streptomisin", "ml", null, null, null, "Penisilin-Streptomisin", null },
                    { new Guid("0199a000-0000-7000-8000-000000000006"), "A, D3, E vitaminleri", "ml", null, null, null, "Vitamin AD3E", null },
                    { new Guid("0199a000-0000-7000-8000-000000000007"), null, "ml", null, null, null, "Şap aşısı", null },
                    { new Guid("0199a000-0000-7000-8000-000000000008"), null, "ml", null, null, null, "Koyun-keçi çiçek aşısı", null },
                    { new Guid("0199a000-0000-7000-8000-000000000009"), null, "ml", null, null, null, "Enterotoksemi aşısı", null },
                    { new Guid("0199a000-0000-7000-8000-00000000000a"), null, "doz", null, null, null, "Brusella aşısı", null },
                    { new Guid("0199a000-0000-7000-8000-00000000000b"), null, "ml", null, null, null, "PPR (Küçük ruminant vebası) aşısı", null }
                });

            migrationBuilder.CreateIndex(
                name: "ix_animal_location_events_animal_id_since",
                table: "animal_location_events",
                columns: new[] { "animal_id", "since" });

            migrationBuilder.CreateIndex(
                name: "ix_animal_location_events_recorded_by_id",
                table: "animal_location_events",
                column: "recorded_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_animal_weights_animal_id_weighed_on",
                table: "animal_weights",
                columns: new[] { "animal_id", "weighed_on" });

            migrationBuilder.CreateIndex(
                name: "ix_animal_weights_recorded_by_id",
                table: "animal_weights",
                column: "recorded_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_birth_events_mother_id_birth_date",
                table: "birth_events",
                columns: new[] { "mother_id", "birth_date" });

            migrationBuilder.CreateIndex(
                name: "ix_birth_events_recorded_by_id",
                table: "birth_events",
                column: "recorded_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_medicines_farm_id_name",
                table: "medicines",
                columns: new[] { "farm_id", "name" });

            migrationBuilder.CreateIndex(
                name: "ix_treatments_animal_id_administered_at",
                table: "treatments",
                columns: new[] { "animal_id", "administered_at" });

            migrationBuilder.CreateIndex(
                name: "ix_treatments_batch_id",
                table: "treatments",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatments_medicine_id",
                table: "treatments",
                column: "medicine_id");

            migrationBuilder.CreateIndex(
                name: "ix_treatments_recorded_by_id",
                table: "treatments",
                column: "recorded_by_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "animal_location_events");

            migrationBuilder.DropTable(
                name: "animal_weights");

            migrationBuilder.DropTable(
                name: "birth_events");

            migrationBuilder.DropTable(
                name: "treatments");

            migrationBuilder.DropTable(
                name: "medicines");
        }
    }
}
