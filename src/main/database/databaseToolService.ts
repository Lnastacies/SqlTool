import type { DatabaseToolGateway } from './databaseToolGateway'
import type {
  DataSyncRequest,
  DataTransferRequest,
  StructureSyncRequest,
} from './databaseToolTypes'
import { DataSyncService } from './dataSyncService'
import { DataTransferService } from './dataTransferService'
import { StructureSyncService } from './structureSyncService'

export class DatabaseToolService {
  private readonly transfer: DataTransferService
  private readonly dataSync: DataSyncService
  private readonly structureSync: StructureSyncService

  constructor(gateway: DatabaseToolGateway) {
    this.transfer = new DataTransferService(gateway)
    this.dataSync = new DataSyncService(gateway)
    this.structureSync = new StructureSyncService(gateway)
  }

  previewTransfer(request: DataTransferRequest) {
    return this.transfer.preview(request)
  }

  executeTransfer(request: DataTransferRequest) {
    return this.transfer.execute(request)
  }

  previewDataSync(request: DataSyncRequest) {
    return this.dataSync.preview(request)
  }

  executeDataSync(request: DataSyncRequest) {
    return this.dataSync.execute(request)
  }

  previewStructureSync(request: StructureSyncRequest) {
    return this.structureSync.preview(request)
  }

  executeStructureSync(request: StructureSyncRequest) {
    return this.structureSync.execute(request)
  }
}
