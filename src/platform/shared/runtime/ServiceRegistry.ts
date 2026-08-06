import { deterministicSort } from "../utilities";

export class ServiceRegistry<TService extends { serviceId: string }> {
  private readonly services = new Map<string, TService>();

  register(service: TService): void {
    if (!service.serviceId || this.services.has(service.serviceId)) {
      throw new Error(`service registration conflict: ${service.serviceId}`);
    }
    this.services.set(service.serviceId, service);
  }

  get(serviceId: string): TService | undefined {
    return this.services.get(serviceId);
  }

  require(serviceId: string): TService {
    const found = this.get(serviceId);
    if (!found) {
      throw new Error(`service not found: ${serviceId}`);
    }
    return found;
  }

  list(): TService[] {
    return deterministicSort([...this.services.values()], (service) => service.serviceId);
  }
}
