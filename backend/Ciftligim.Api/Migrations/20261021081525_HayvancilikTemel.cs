using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ciftligim.Api.Migrations
{
    /// <inheritdoc />
    public partial class HayvancilikTemel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "farms",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_farms", x => x.id);
                    table.ForeignKey(
                        name: "fk_farms_users_created_by_id",
                        column: x => x.created_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "species",
                columns: table => new
                {
                    id = table.Column<short>(type: "smallint", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_species", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "farm_members",
                columns: table => new
                {
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    invited_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_farm_members", x => new { x.farm_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_farm_members_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_farm_members_users_invited_by_id",
                        column: x => x.invited_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_farm_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "herds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_herds", x => x.id);
                    table.ForeignKey(
                        name: "fk_herds_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "breeds",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    species_id = table.Column<short>(type: "smallint", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_breeds", x => x.id);
                    table.ForeignKey(
                        name: "fk_breeds_species_species_id",
                        column: x => x.species_id,
                        principalTable: "species",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "herd_assignments",
                columns: table => new
                {
                    herd_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_herd_assignments", x => new { x.herd_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_herd_assignments_herds_herd_id",
                        column: x => x.herd_id,
                        principalTable: "herds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_herd_assignments_users_assigned_by_id",
                        column: x => x.assigned_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_herd_assignments_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "animals",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    herd_id = table.Column<Guid>(type: "uuid", nullable: true),
                    species_id = table.Column<short>(type: "smallint", nullable: false),
                    breed_id = table.Column<int>(type: "integer", nullable: true),
                    ear_tag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    microchip = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    sex = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    birth_date_estimated = table.Column<bool>(type: "boolean", nullable: false),
                    mother_id = table.Column<Guid>(type: "uuid", nullable: true),
                    father_id = table.Column<Guid>(type: "uuid", nullable: true),
                    color_marks = table.Column<string>(type: "text", nullable: true),
                    photo_url = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    acquired_on = table.Column<DateOnly>(type: "date", nullable: true),
                    exited_on = table.Column<DateOnly>(type: "date", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_animals", x => x.id);
                    table.CheckConstraint("ck_animals_not_own_parent", "mother_id <> id AND father_id <> id");
                    table.ForeignKey(
                        name: "fk_animals_animals_father_id",
                        column: x => x.father_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_animals_animals_mother_id",
                        column: x => x.mother_id,
                        principalTable: "animals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_animals_breeds_breed_id",
                        column: x => x.breed_id,
                        principalTable: "breeds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_animals_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_animals_herds_herd_id",
                        column: x => x.herd_id,
                        principalTable: "herds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_animals_species_species_id",
                        column: x => x.species_id,
                        principalTable: "species",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_animals_users_created_by_id",
                        column: x => x.created_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "species",
                columns: new[] { "id", "code", "name" },
                values: new object[,]
                {
                    { (short)1, "dog", "Köpek" },
                    { (short)2, "donkey", "Eşek" },
                    { (short)3, "cattle", "İnek / Sığır" },
                    { (short)4, "goat", "Keçi" },
                    { (short)5, "sheep", "Koyun" }
                });

            migrationBuilder.InsertData(
                table: "breeds",
                columns: new[] { "id", "name", "species_id" },
                values: new object[,]
                {
                    { 1, "Akkaraman", (short)5 },
                    { 2, "Morkaraman", (short)5 },
                    { 3, "Kıvırcık", (short)5 },
                    { 4, "İvesi", (short)5 },
                    { 5, "Merinos", (short)5 },
                    { 6, "Karayaka", (short)5 },
                    { 7, "Sakız", (short)5 },
                    { 8, "Dağlıç", (short)5 },
                    { 9, "Romanov", (short)5 },
                    { 10, "Melez", (short)5 },
                    { 20, "Kıl keçisi", (short)4 },
                    { 21, "Saanen", (short)4 },
                    { 22, "Ankara keçisi", (short)4 },
                    { 23, "Kilis", (short)4 },
                    { 24, "Honamlı", (short)4 },
                    { 25, "Melez", (short)4 },
                    { 40, "Holstein", (short)3 },
                    { 41, "Simental", (short)3 },
                    { 42, "Montofon (Esmer)", (short)3 },
                    { 43, "Jersey", (short)3 },
                    { 44, "Yerli Kara", (short)3 },
                    { 45, "Boz Irk", (short)3 },
                    { 46, "Melez", (short)3 },
                    { 60, "Kangal", (short)1 },
                    { 61, "Akbaş", (short)1 },
                    { 62, "Kars Çoban Köpeği", (short)1 },
                    { 63, "Melez", (short)1 },
                    { 80, "Anadolu eşeği", (short)2 },
                    { 81, "Melez", (short)2 }
                });

            migrationBuilder.CreateIndex(
                name: "ix_animals_breed_id",
                table: "animals",
                column: "breed_id");

            migrationBuilder.CreateIndex(
                name: "ix_animals_created_by_id",
                table: "animals",
                column: "created_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_animals_farm_id_ear_tag",
                table: "animals",
                columns: new[] { "farm_id", "ear_tag" },
                unique: true,
                filter: "ear_tag IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_animals_father_id",
                table: "animals",
                column: "father_id");

            migrationBuilder.CreateIndex(
                name: "ix_animals_herd_id",
                table: "animals",
                column: "herd_id");

            migrationBuilder.CreateIndex(
                name: "ix_animals_mother_id",
                table: "animals",
                column: "mother_id");

            migrationBuilder.CreateIndex(
                name: "ix_animals_species_id",
                table: "animals",
                column: "species_id");

            migrationBuilder.CreateIndex(
                name: "ix_breeds_species_id_name",
                table: "breeds",
                columns: new[] { "species_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_farm_members_invited_by_id",
                table: "farm_members",
                column: "invited_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_farm_members_user_id",
                table: "farm_members",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_farms_created_by_id",
                table: "farms",
                column: "created_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_herd_assignments_assigned_by_id",
                table: "herd_assignments",
                column: "assigned_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_herd_assignments_user_id",
                table: "herd_assignments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_herds_farm_id_name",
                table: "herds",
                columns: new[] { "farm_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_species_code",
                table: "species",
                column: "code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "animals");

            migrationBuilder.DropTable(
                name: "farm_members");

            migrationBuilder.DropTable(
                name: "herd_assignments");

            migrationBuilder.DropTable(
                name: "breeds");

            migrationBuilder.DropTable(
                name: "herds");

            migrationBuilder.DropTable(
                name: "species");

            migrationBuilder.DropTable(
                name: "farms");
        }
    }
}
