package com.rms.table;

import com.rms.table.TableService.Area;
import com.rms.table.TableService.AreaInput;
import com.rms.table.TableService.DiningTable;
import com.rms.table.TableService.Floor;
import com.rms.table.TableService.FloorInput;
import com.rms.table.TableService.Layout;
import com.rms.table.TableService.Position;
import com.rms.table.TableService.TableInput;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TableController {
    private final TableService service;
    private final com.rms.ordering.CashierService cashier;

    public TableController(TableService service, com.rms.ordering.CashierService cashier) {
        this.service = service;
        this.cashier = cashier;
    }

    /* ---------------------------------------------------------------- Tầng + sơ đồ */

    @GetMapping("/floors")
    public List<Floor> floors() {
        return service.floors();
    }

    /** Sơ đồ trực tiếp (chỉ xem) cho Quản lý: cùng dữ liệu với sơ đồ thu ngân. */
    @GetMapping("/floors/live")
    public com.rms.ordering.CashierService.Floor live() {
        return cashier.floor();
    }

    @PostMapping("/floors")
    @ResponseStatus(HttpStatus.CREATED)
    public Floor createFloor(@RequestBody FloorInput in) {
        return service.createFloor(in);
    }

    @PutMapping("/floors/{id}")
    public Floor updateFloor(@PathVariable String id, @RequestBody FloorInput in) {
        return service.updateFloor(id, in);
    }

    @DeleteMapping("/floors/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFloor(@PathVariable String id) {
        service.deleteFloor(id);
    }

    @PutMapping("/floors/{id}/layout")
    public Floor saveLayout(@PathVariable String id, @RequestBody Layout in) {
        return service.saveLayout(id, in);
    }

    /* ---------------------------------------------------------------- Khu vực, bàn */

    @GetMapping("/areas")
    public List<Area> areas() {
        return service.areas();
    }

    @PostMapping("/areas")
    @ResponseStatus(HttpStatus.CREATED)
    public Area createArea(@RequestBody AreaInput in) {
        return service.createArea(in);
    }

    @PutMapping("/areas/{id}")
    public Area updateArea(@PathVariable String id, @RequestBody AreaInput in) {
        return service.updateArea(id, in);
    }

    @DeleteMapping("/areas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteArea(@PathVariable String id) {
        service.deleteArea(id);
    }

    @GetMapping("/tables")
    public List<DiningTable> tables() {
        return service.tables();
    }

    @PostMapping("/tables")
    @ResponseStatus(HttpStatus.CREATED)
    public DiningTable createTable(@RequestBody TableInput in) {
        return service.createTable(in);
    }

    @PutMapping("/tables/{id}")
    public DiningTable updateTable(@PathVariable String id, @RequestBody TableInput in) {
        return service.updateTable(id, in);
    }

    @PatchMapping("/tables/{id}/position")
    public DiningTable move(@PathVariable String id, @RequestBody Position pos) {
        return service.moveTable(id, pos);
    }

    @DeleteMapping("/tables/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTable(@PathVariable String id) {
        service.deleteTable(id);
    }
}
