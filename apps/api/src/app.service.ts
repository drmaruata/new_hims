import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return {
      status: "ok",
      service: "hims-api",
      timestamp: new Date().toISOString(),
    };
  }
}
