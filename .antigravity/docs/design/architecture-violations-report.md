# 🔍 Báo cáo Vi phạm Kiến trúc (Architecture Violations Report)
**Ngày review:** 2026-04-20  
**Reviewer:** TechLead (Antigravity Agent)  
**Phạm vi:** `profix-service` - Toàn bộ 4 tầng (API, Application, Domain, Infrastructure)

---

## Tổng quan Dependency Rule

Quy tắc vàng của Clean Architecture: **Dependency phải hướng vào trong (Domain)**

```
✅ ĐÚNG: API → Application → Domain
✅ ĐÚNG: Infrastructure → Application → Domain
❌ SAI:  Domain → Infrastructure (vi phạm!)
❌ SAI:  Domain → API (vi phạm!)
❌ SAI:  Application Port → Infrastructure Entity (vi phạm!)
❌ SAI:  API → Infrastructure Service trực tiếp (vi phạm!)
```

---

## 🔴 Mức Critical – Vi phạm nghiêm trọng

### V1. Domain Layer import Infrastructure (3 file)

Domain là lõi thuần túy, KHÔNG ĐƯỢC phụ thuộc bất kỳ tầng ngoài nào.

| File | Import vi phạm | Mô tả |
|------|---------------|-------|
| `domain/model/productservicecatalog/PVBProductServiceCatalog.java` | `infrastructure.persistence.entity.PVBProductServiceCatalogEntity` | Domain Model chứa method `toPVBProductServiceCatalogEntity()` trả về trực tiếp Entity JPA. Domain biết về tầng persistence! |
| `domain/model/user/PVBUserModelBuilder.java` | `infrastructure.persistence.mapper.PVBMapperConfig` | MapStruct Mapper nằm trong Domain lại ref config từ Infrastructure |
| `domain/model/job/PVBJob.java` | `infrastructure.utils.PVBDateUtils` + `jakarta.persistence.EnumType` | Domain Model dùng JPA annotation (`@Enumerated`) và utility class từ Infrastructure |

**Hậu quả:** Nếu đổi ORM (ví dụ từ JPA sang jOOQ), phải sửa cả Domain — vi phạm nguyên tắc core.

### V2. Domain Layer import API DTO (2 file)

Domain Service đang nhận trực tiếp DTO từ tầng API thay vì dùng Domain Model/Command object.

| File | Import vi phạm |
|------|---------------|
| `domain/service/PVBSystemJobDomainService.java` | `api.dto.request.jobs.PVBCreateGroupFeeCodeRequest` |
| `domain/service/PVBFeeDomainService.java` | `api.dto.request.fee.PVBFeeConditionRequest` |

**Hậu quả:** Domain logic bị ghim chặt vào cấu trúc HTTP request. Nếu cùng logic được gọi từ Kafka consumer hay batch job, sẽ phải tạo DTO giả hoặc duplicate code.

### V3. Application Ports import Infrastructure Entity (6 file)

Output Ports (interfaces) là hợp đồng trừu tượng, nhưng đang trả về Entity cụ thể thay vì Domain Model.

| File | Import vi phạm |
|------|---------------|
| `application/port/output/PVBUserActionLogRepository.java` | `infrastructure.persistence.entity.PVBUserActionLog` |
| `application/port/output/PVBFeeCollectionHistoryRepository.java` | `infrastructure.persistence.entity.PVBFeeCollectionHistoryEntity` |
| `application/port/output/promotion/PVBPromotionRepository.java` | `infrastructure.persistence.entity.promotion.PVBPromotion` |
| `application/port/output/promotion/PVBPromotionRuleRepository.java` | `infrastructure.persistence.entity.promotion.PVBPromotionRule` |
| `application/port/output/promotion/PVBPromotionFeeTierRepository.java` | `infrastructure.persistence.entity.promotion.PVBPromotionFeeTier` |
| `application/port/output/promotion/PVBPromotionConditionRepository.java` | `infrastructure.persistence.entity.promotion.PVBPromotionCondition` |

**Hậu quả**: Application ports trở thành bị phụ thuộc hoàn toàn vào JPA Entity. Port lẽ ra phải thao tác trên Domain Model thuần.

### V4. Input Port import Infrastructure Entity (1 file)

| File | Import vi phạm |
|------|---------------|
| `application/port/input/PVBPromotionUserCase.java` | `infrastructure.persistence.entity.promotion.PVBPromotion` |

**Hậu quả:** Use Case interface (cửa trước hệ thống) trả về trực tiếp Entity JPA. Controller sẽ thấy cả annotation `@Entity`, `@Table` — rò rỉ implementation detail.

---

## 🟡 Mức Warning – Vi phạm cần cải thiện

### V5. API Controller import Infrastructure trực tiếp (nhiều file)

Controller nên chỉ biết Use Case Interface, không nên biết Implementation.

| File | Import vi phạm | Ghi chú |
|------|---------------|---------|
| `api/controller/PVBSystemParameterController.java` | `infrastructure.service.PVBSystemParameterService` | Inject concrete class thay vì interface |
| `api/controller/PVBUserController.java` | `infrastructure.provider.PVBTokenProvider`, `infrastructure.security.*` | Controller trộn logic auth + business |
| `api/dto/response/user/PVBUserResponse.java` | `infrastructure.persistence.entity.PVBUserEntity` | DTO tham chiếu Entity (chỉ dùng cho Javadoc, nhưng vẫn tạo compile dependency) |
| `api/dto/request/jobs/PVBCreateSystemJobRequest.java` | `infrastructure.utils.PVBDateUtils` | Request DTO dùng constant từ infra |
| `api/mapper/PVBProductServiceApiMapper.java` | `infrastructure.persistence.mapper.PVBMapperConfig` | API Mapper share config với Infrastructure Mapper |
| `api/mapper/PVBApprovalApiMapper.java` | `infrastructure.persistence.mapper.PVBMapperConfig` | (Giống trên) |

### V6. `@Transactional` đặt ở Controller (27 chỗ!)

Transaction management là concern của tầng Service/Infrastructure, không phải Controller.

**Danh sách Controllers vi phạm:**
- `PVBFeeCodeController` (4 chỗ)
- `PVBFeeConditionController` (6 chỗ)
- `PVBFeeFormulaController` (5 chỗ)
- `PVBUserController` (4 chỗ)
- `PVBSystemParameterController` (2 chỗ)
- `PVBGroupCustomerController` (4 chỗ)
- `PVBSystemJobController` (1 chỗ)

**Hậu quả:** Controller đang quản lý transaction boundary. Nếu 1 API cần gọi 2 service methods trong 1 transaction, hoặc nếu service method cần được gọi từ nơi khác (không qua API), transaction scope sẽ sai.

---

## 🟢 Mức Info – Ghi nhận

### V7. `@PVBSecured` annotation nằm ở Infrastructure

`@PVBSecured` là annotation bảo mật được dùng trực tiếp trong Controller. Về mặt kỹ thuật, nó tạo dependency `api → infrastructure.security`. Tuy nhiên, do tính chất cross-cutting của Security, đây là trade-off có thể chấp nhận được. Nếu muốn nghiêm ngặt hơn, có thể di chuyển annotation definition sang `domain/anotation/`.

---

## Thống kê tổng hợp

| Mức độ | Số lượng vi phạm | Tầng bị ảnh hưởng |
|--------|-----------------|-------------------|
| 🔴 Critical | **12 file** | Domain, Application Ports |
| 🟡 Warning | **6 file + 27 chỗ @Transactional** | API Controllers |
| 🟢 Info | **nhiều file** | API → Infrastructure Security |

---

## Gợi ý Roadmap sửa chữa (Ưu tiên từ cao → thấp)

1. **Tạo Domain Model cho Promotion** (`PVBPromotionDomain`, `PVBPromotionRuleDomain`...) để thay thế Entity ở Application Ports.
2. **Tạo Command/Input objects** cho Domain Service thay vì nhận API DTO trực tiếp.
3. **Xóa method `toPVBProductServiceCatalogEntity()`** ra khỏi Domain Model, chuyển sang Mapper ở Infrastructure.
4. **Di chuyển `@Transactional`** từ Controller xuống Service layer.
5. **Tạo Input Port Interface `PVBSystemParameterUseCase`** cho `PVBSystemParameterService`.
6. **Di chuyển `PVBMapperConfig`** sang package chung (domain hoặc tạo package `shared/`).
