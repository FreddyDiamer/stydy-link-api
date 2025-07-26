import { Module } from '@nestjs/common';
import { ServicesModule } from './services/services.module';
import { RequestsModule } from './requests/requests.module';
import { ServiceResponsesModule } from './service-responses/service-responses.module';
import { RequestResponsesModule } from './request-responses/request-responses.module';
import { DealsModule } from './deals/deals.module';

/**
 * Домен Marketplace - торговая площадка репетиторских услуг
 *
 * Содержит все сущности, связанные с торговой площадкой:
 * - Service: услуги, предлагаемые репетиторами
 * - Request: заявки студентов на поиск репетиторов
 * - ServiceResponse: отклики студентов на услуги репетиторов
 * - RequestResponse: отклики репетиторов на заявки студентов (TODO)
 * - Deal: сделки между студентами и репетиторами (TODO)
 *
 * Домен использует справочники из Education для валидации
 * предметов и преподавателей.
 */
@Module({
  imports: [
    ServicesModule,
    RequestsModule,
    ServiceResponsesModule,
    RequestResponsesModule,
    DealsModule,
  ],
  exports: [
    ServicesModule,
    RequestsModule,
    ServiceResponsesModule,
    RequestResponsesModule,
    DealsModule,
  ],
})
export class MarketplaceModule {}
