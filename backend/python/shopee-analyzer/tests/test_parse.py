"""测试巴西数字格式解析函数"""
import math
import pytest
from analyzer import parse_br_number, parse_pct, parse_int


class TestParseBrNumber:
    def test_comma_decimal(self):
        assert parse_br_number("126,24") == 126.24

    def test_dot_thousands(self):
        assert parse_br_number("10.136") == 10136.0

    def test_integer(self):
        assert parse_br_number("42") == 42.0

    def test_empty_string(self):
        assert parse_br_number("") == 0.0

    def test_dash(self):
        assert parse_br_number("-") == 0.0
        assert parse_br_number("--") == 0.0

    def test_none_string(self):
        assert parse_br_number("None") == 0.0

    def test_nan_string(self):
        assert parse_br_number("nan") == 0.0

    def test_float_input(self):
        assert parse_br_number(100.5) == 100.5

    def test_nan_float(self):
        assert parse_br_number(float("nan")) == 0.0


class TestParsePct:
    def test_normal(self):
        assert parse_pct("1,62%") == pytest.approx(0.0162)

    def test_integer_percent(self):
        assert parse_pct("5%") == 0.05

    def test_float_input(self):
        assert parse_pct(0.05) == 0.05

    def test_nan_input(self):
        assert parse_pct(float("nan")) == 0.0


class TestParseInt:
    def test_normal(self):
        assert parse_int("7") == 7

    def test_br_format(self):
        assert parse_int("1.234") == 1234

    def test_float_input(self):
        assert parse_int(5.0) == 5

    def test_nan_float(self):
        assert parse_int(float("nan")) == 0
