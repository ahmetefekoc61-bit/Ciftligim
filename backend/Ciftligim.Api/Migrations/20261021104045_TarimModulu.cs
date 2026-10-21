using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ciftligim.Api.Migrations
{
    /// <inheritdoc />
    public partial class TarimModulu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "crops",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crops", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "parcels",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    farm_id = table.Column<Guid>(type: "uuid", nullable: false),
                    province = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    district = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    neighborhood = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    tkgm_neighborhood_id = table.Column<int>(type: "integer", nullable: true),
                    block_no = table.Column<int>(type: "integer", nullable: false),
                    parcel_no = table.Column<int>(type: "integer", nullable: false),
                    nickname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    locality = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    quality = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    area_m2 = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    ownership = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    share_numerator = table.Column<int>(type: "integer", nullable: true),
                    share_denominator = table.Column<int>(type: "integer", nullable: true),
                    title_owner = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    boundary_geo_json = table.Column<string>(type: "jsonb", nullable: true),
                    center_lat = table.Column<double>(type: "double precision", nullable: true),
                    center_lon = table.Column<double>(type: "double precision", nullable: true),
                    tkgm_fetched_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_parcels", x => x.id);
                    table.CheckConstraint("ck_parcels_area", "area_m2 IS NULL OR area_m2 > 0");
                    table.CheckConstraint("ck_parcels_share", "(share_numerator IS NULL AND share_denominator IS NULL) OR (share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)");
                    table.ForeignKey(
                        name: "fk_parcels_farms_farm_id",
                        column: x => x.farm_id,
                        principalTable: "farms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_parcels_users_created_by_id",
                        column: x => x.created_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "crop_seasons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    parcel_id = table.Column<Guid>(type: "uuid", nullable: false),
                    year = table.Column<short>(type: "smallint", nullable: false),
                    crop_id = table.Column<int>(type: "integer", nullable: true),
                    variety = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    planted_area_m2 = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    sowing_date = table.Column<DateOnly>(type: "date", nullable: true),
                    harvest_date = table.Column<DateOnly>(type: "date", nullable: true),
                    yield_kg = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crop_seasons", x => x.id);
                    table.CheckConstraint("ck_crop_seasons_year", "year BETWEEN 1950 AND 2200");
                    table.ForeignKey(
                        name: "fk_crop_seasons_crops_crop_id",
                        column: x => x.crop_id,
                        principalTable: "crops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_crop_seasons_parcels_parcel_id",
                        column: x => x.parcel_id,
                        principalTable: "parcels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "field_operations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    parcel_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    performed_on = table.Column<DateOnly>(type: "date", nullable: false),
                    product = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    cost = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    recorded_by_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_field_operations", x => x.id);
                    table.ForeignKey(
                        name: "fk_field_operations_parcels_parcel_id",
                        column: x => x.parcel_id,
                        principalTable: "parcels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_field_operations_users_recorded_by_id",
                        column: x => x.recorded_by_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "parcel_leases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    parcel_id = table.Column<Guid>(type: "uuid", nullable: false),
                    counterparty = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    terms = table.Column<string>(type: "text", nullable: true),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_parcel_leases", x => x.id);
                    table.CheckConstraint("ck_parcel_leases_dates", "end_date IS NULL OR end_date >= start_date");
                    table.ForeignKey(
                        name: "fk_parcel_leases_parcels_parcel_id",
                        column: x => x.parcel_id,
                        principalTable: "parcels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "crops",
                columns: new[] { "id", "name" },
                values: new object[,]
                {
                    { 1, "Buğday" },
                    { 2, "Arpa" },
                    { 3, "Yulaf" },
                    { 4, "Çavdar" },
                    { 5, "Tritikale" },
                    { 6, "Mısır (dane)" },
                    { 7, "Mısır (silajlık)" },
                    { 8, "Ayçiçeği" },
                    { 9, "Kanola" },
                    { 10, "Nohut" },
                    { 11, "Mercimek" },
                    { 12, "Fasulye" },
                    { 13, "Yonca" },
                    { 14, "Korunga" },
                    { 15, "Fiğ" },
                    { 16, "Şeker pancarı" },
                    { 17, "Patates" },
                    { 18, "Soğan" },
                    { 19, "Karpuz" },
                    { 20, "Kavun" },
                    { 21, "Domates" },
                    { 22, "Biber" },
                    { 23, "Pamuk" },
                    { 24, "Diğer" }
                });

            migrationBuilder.CreateIndex(
                name: "ix_crop_seasons_crop_id",
                table: "crop_seasons",
                column: "crop_id");

            migrationBuilder.CreateIndex(
                name: "ix_crop_seasons_parcel_id_year",
                table: "crop_seasons",
                columns: new[] { "parcel_id", "year" });

            migrationBuilder.CreateIndex(
                name: "ix_crops_name",
                table: "crops",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_field_operations_parcel_id_performed_on",
                table: "field_operations",
                columns: new[] { "parcel_id", "performed_on" });

            migrationBuilder.CreateIndex(
                name: "ix_field_operations_recorded_by_id",
                table: "field_operations",
                column: "recorded_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_parcel_leases_parcel_id",
                table: "parcel_leases",
                column: "parcel_id");

            migrationBuilder.CreateIndex(
                name: "ix_parcels_created_by_id",
                table: "parcels",
                column: "created_by_id");

            migrationBuilder.CreateIndex(
                name: "ix_parcels_farm_id_province_district_neighborhood_block_no_par",
                table: "parcels",
                columns: new[] { "farm_id", "province", "district", "neighborhood", "block_no", "parcel_no" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "crop_seasons");

            migrationBuilder.DropTable(
                name: "field_operations");

            migrationBuilder.DropTable(
                name: "parcel_leases");

            migrationBuilder.DropTable(
                name: "crops");

            migrationBuilder.DropTable(
                name: "parcels");
        }
    }
}
